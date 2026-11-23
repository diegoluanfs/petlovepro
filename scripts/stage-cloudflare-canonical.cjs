#!/usr/bin/env node
'use strict';
/**
 * Preserves the original Cloudflare staging validator but ensures that the
 * storefront entrypoint copied into the final artifact is the canonical,
 * already-built web/app.js. Never modifies public/app.js or catalog data.
 *
 * Usage: node scripts/stage-cloudflare-canonical.cjs <temporary-parent-dir>
 * Prints only the final absolute deployment directory on stdout.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const original = path.join(__dirname, 'stage-cloudflare.cjs');
const parentArgument = process.argv[2];
const canonical = path.join(root, 'web', 'app.js');
const built = path.join(root, 'site-dist', 'app.js');
let working;
function fail(message) { throw new Error('[PetLovePro staging] ' + message); }
function assertPlainFile(filepath) {
  if (!fs.existsSync(filepath) || !fs.lstatSync(filepath).isFile()) fail('Arquivo requerido ausente ou nao regular: ' + path.relative(root,filepath));
}
function findRoots(dirname, depth = 0) {
  if (depth > 6) fail('Profundidade excessiva no staging');
  const entries = fs.readdirSync(dirname, { withFileTypes: true });
  const names = new Set(entries.map(e => e.name));
  const roots = names.has('index.html') && names.has('app.js') && names.has('firebase-config.js') ? [dirname] : [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) fail('Link simbolico nao permitido no staging: ' + entry.name);
    if (entry.isDirectory()) roots.push(...findRoots(path.join(dirname,entry.name),depth+1));
  }
  return roots;
}
function main() {
  if (!parentArgument || process.argv.length !== 3) fail('Informe um unico diretorio temporario de destino');
  const parent = path.resolve(parentArgument);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) fail('Diretorio temporario inexistente: ' + parent);
  [original,canonical,built].forEach(assertPlainFile);
  const expected = fs.readFileSync(canonical);
  if (!fs.readFileSync(built).equals(expected)) fail('site-dist/app.js difere de web/app.js: execute npm run build antes do staging');
  if (!expected.toString('utf8').includes('PETLOVEPRO_FIREBASE')) fail('web/app.js nao usa a configuracao Firebase esperada');

  working = fs.mkdtempSync(path.join(parent, 'petlovepro-canonical-'));
  // The original stage builder must run first, with all original allowlist
  // checks. No error from that validator is ignored.
  const result = spawnSync(process.execPath, [original,working], {
    cwd:root, encoding:'utf8', maxBuffer:16*1024*1024,
  });
  if (result.stdout) process.stderr.write(result.stdout.endsWith('\n') ? result.stdout : result.stdout+'\n');
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) fail('Validador original recusou o staging (' + (result.status ?? result.signal) + ')');

  const roots = findRoots(working);
  if (roots.length !== 1) fail('Esperado exatamente um diretorio publicavel; encontrados: ' + roots.length);
  const deploy = roots[0];
  // The build's HTML is the audited source of truth. The original legacy
  // staging may ship an older index.html even when the build itself is valid.
  // Never modify repo files: only repair the temporary, already validated output.
  const canonicalHtmlPath = path.join(root,'site-dist','index.html');
  const sourceHtmlPath = path.join(root,'index.html');
  [canonicalHtmlPath,sourceHtmlPath].forEach(assertPlainFile);
  const canonicalHtml = fs.readFileSync(canonicalHtmlPath,'utf8');
  if (canonicalHtml !== fs.readFileSync(sourceHtmlPath,'utf8'))
    fail('site-dist/index.html diverge do index.html de origem; execute npm run build');
  function scriptOrderOK(html) {
    const names=[];
    for (const tag of html.matchAll(/<script\b([^>]*)>/gi)) {
      const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag[1]);
      if (!src) continue;
      names.push((src[1] ?? src[2] ?? src[3]).replace(/^\.\//,'').split(/[?#]/)[0]);
    }
    const configPositions=names.flatMap((name,i)=>name==='/firebase-config.js'||name==='firebase-config.js'?[i]:[]);
    const appPositions=names.flatMap((name,i)=>name==='/app.js'||name==='app.js'?[i]:[]);
    return configPositions.length===1 && appPositions.length===1 && configPositions[0]<appPositions[0];
  }
  if (!scriptOrderOK(canonicalHtml)) fail('HTML canonico nao carrega firebase-config.js antes de app.js');
  const stagedHtmlPath=path.join(deploy,'index.html');
  assertPlainFile(stagedHtmlPath);
  if (!scriptOrderOK(fs.readFileSync(stagedHtmlPath,'utf8'))) {
    fs.copyFileSync(canonicalHtmlPath,stagedHtmlPath);
    process.stderr.write('[PetLovePro staging] index.html do staging alinhado ao HTML canonico.\n');
  }
  if (!scriptOrderOK(fs.readFileSync(stagedHtmlPath,'utf8'))) fail('HTML deve carregar firebase-config.js antes de app.js');
  const config = fs.readFileSync(path.join(deploy,'firebase-config.js'),'utf8');
  if (!config.includes('PETLOVEPRO_FIREBASE') || /\bexport\s+(?:const|default|\{)/.test(config)) fail('firebase-config.js nao corresponde ao script global esperado');

  // Fix only this public JS artifact, never the legacy module in the repo.
  const deployApp = path.join(deploy,'app.js');
  assertPlainFile(deployApp);
  if (!fs.readFileSync(deployApp).equals(expected)) {
    fs.copyFileSync(canonical,deployApp);
    process.stderr.write('[PetLovePro staging] app.js do staging alinhado ao frontend canonico.\n');
  }
  if (!fs.readFileSync(deployApp).equals(expected)) fail('Falha ao verificar app.js do staging');
  process.stderr.write('[PetLovePro staging] Staging aprovado.\n');
  process.stdout.write(deploy+'\n');
  working = undefined; // Do not remove: consumed by Wrangler in the next step.
}
try { main(); }
catch (error) {
  console.error(error.message);
  process.exitCode=1;
  if (working) fs.rmSync(working,{recursive:true,force:true});
}
