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
  // The legacy packager does not necessarily include generated files from
  // site-dist/. Copy the audited, public build artifacts into the SAME folder
  // that Wrangler will deploy. Never copy dist/ or private/. The original
  // allowlist validator has already succeeded before any overlay takes place.
  function publishBuilt(relative) {
    const source = path.join(root, 'site-dist', relative);
    const target = path.join(deploy, relative);
    assertPlainFile(source);
    const parent = path.dirname(target);
    if (fs.existsSync(parent) && (!fs.lstatSync(parent).isDirectory() || fs.lstatSync(parent).isSymbolicLink()))
      fail('Diretorio inseguro no staging: ' + relative);
    fs.mkdirSync(parent, { recursive: true });
    if (fs.existsSync(target) && (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink()))
      fail('Destino inseguro no staging: ' + relative);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(fs.readFileSync(source)))
      fs.copyFileSync(source, target);
    if (!fs.readFileSync(target).equals(fs.readFileSync(source)))
      fail('Arquivo nao corresponde ao build: ' + relative);
  }
  for (const [builtName, sourceName] of [
    ['style.css', 'web/style.css'],
    ['catalog-commerce.js', 'dist/catalog-commerce.js'],
    ['catalog-commerce.json', 'dist/catalog-commerce.json'],
  ]) {
    const b = path.join(root, 'site-dist', builtName);
    const source = path.join(root, sourceName);
    assertPlainFile(b); assertPlainFile(source);
    if (!fs.readFileSync(b).equals(fs.readFileSync(source)))
      fail('Build desatualizado: site-dist/' + builtName + ' difere de ' + sourceName);
  }
  const coreFiles = [
    'index.html', 'app.js', 'firebase-config.js', 'style.css',
    'catalog-commerce.js', 'catalog-commerce.json', 'site-data.json',
    'catalog.js', 'commerce-client.js', 'seller-public.json', 'favicon.svg',
  ];
  for (const name of coreFiles) publishBuilt(name);
  const stylesheet = fs.readFileSync(path.join(deploy, 'style.css'), 'utf8');
  if (!stylesheet.trim() || /^\s*</.test(stylesheet) || !stylesheet.includes('{'))
    fail('style.css ausente ou invalido; nao publicar HTML como CSS');
  const commerceJs = fs.readFileSync(path.join(deploy, 'catalog-commerce.js'),'utf8');
  if (!commerceJs.includes('PetLoveProCommerceCatalog'))
    fail('catalog-commerce.js nao contem o catalogo comercial esperado');
  const commerce = JSON.parse(fs.readFileSync(path.join(deploy, 'catalog-commerce.json'),'utf8'));
  const siteData = JSON.parse(fs.readFileSync(path.join(deploy, 'site-data.json'),'utf8'));
  if (!Array.isArray(commerce.items) || commerce.items.length !== 60 ||
      commerce.items.filter(x => x.kind === 'book').length !== 50 ||
      commerce.items.filter(x => x.kind === 'collection').length !== 10)
    fail('catalog-commerce.json nao contem os 50 livros e 10 colecoes');
  if (!Array.isArray(siteData.books) || siteData.books.length !== 50 ||
      !Array.isArray(siteData.collections) || siteData.collections.length !== 10)
    fail('site-data.json nao contem o catalogo editorial esperado');
  // Covers of articles and landing pages may live in public/assets/covers/.
  // Never use a blanket directory copy: every public image must match its
  // original file in public/assets, and all other extensions are rejected.
  const builtAssets = path.join(root, 'site-dist', 'assets');
  const publicAssets = path.join(root, 'public', 'assets');
  for (const dir of [builtAssets, publicAssets]) {
    if (!fs.existsSync(dir) || !fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink())
      fail('Pasta de imagens publicas ausente ou insegura: ' + path.relative(root, dir));
  }
  let imageCount = 0;
  function copyVerifiedImages(relativeDir = '', depth = 0) {
    if (depth > 4) fail('Subpasta de imagens excessivamente profunda: assets/' + relativeDir);
    const current = path.join(builtAssets, relativeDir);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = path.join(relativeDir, entry.name);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(entry.name))
        fail('Nome de imagem nao autorizado no build: assets/' + relative);
      const source = path.join(publicAssets, relative);
      if (entry.isDirectory()) {
        if (!fs.existsSync(source) || !fs.lstatSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink())
          fail('Subpasta de imagem nao autorizada no build: assets/' + relative);
        copyVerifiedImages(relative, depth + 1);
        continue;
      }
      if (!entry.isFile() || !/\.(?:png|jpe?g|webp|avif|svg|gif)$/i.test(entry.name))
        fail('Imagem nao autorizada no build: assets/' + relative);
      if (!fs.existsSync(source) || !fs.lstatSync(source).isFile() || fs.lstatSync(source).isSymbolicLink())
        fail('Imagem sem origem publica verificada: assets/' + relative);
      const builtImage = path.join(current, entry.name);
      const stat = fs.statSync(builtImage);
      if (!stat.size || stat.size > 25 * 1024 * 1024)
        fail('Imagem publica vazia ou grande demais: assets/' + relative);
      if (!fs.readFileSync(builtImage).equals(fs.readFileSync(source)))
        fail('Imagem difere da origem publica: assets/' + relative);
      if (/\.svg$/i.test(entry.name)) {
        const svg = fs.readFileSync(builtImage, 'utf8');
        if (/<script\b|<foreignObject\b|\bon[a-z]+\s*=|javascript\s*:|<!DOCTYPE|<!ENTITY/i.test(svg))
          fail('SVG ativo ou inseguro no build: assets/' + relative);
      }
      imageCount += 1;
      if (imageCount > 500) fail('Quantidade de imagens publicas acima do limite de seguranca');
      publishBuilt(path.join('assets', relative));
    }
  }
  copyVerifiedImages();
  for (let n = 1; n <= 50; n++) {
    const label = String(n).padStart(3, '0');
    publishBuilt('assets/book-' + label + '.webp');
    publishBuilt('previews/book-' + label + '.pdf');
  }
  for (let n = 1; n <= 10; n++)
    publishBuilt('assets/collection-' + String(n).padStart(2, '0') + '.webp');
  for (const entry of fs.readdirSync(path.join(root, 'site-dist', 'previews'), { withFileTypes: true }))
    if (!entry.isFile() || !/^book-\d{3}\.pdf$/.test(entry.name))
      fail('Arquivo de previa nao autorizado no build: ' + entry.name);
  const publishedHtml = fs.readFileSync(path.join(deploy, 'index.html'), 'utf8');
  for (const url of ['/style.css','/firebase-config.js','/catalog-commerce.js','/commerce-client.js','/app.js','/favicon.svg']) {
    if (!publishedHtml.includes(url)) fail('Referencia HTML ausente: ' + url);
    if (!fs.existsSync(path.join(deploy, url.slice(1)))) fail('Dependencia HTML ausente: ' + url);
  }
  if (!scriptOrderOK(publishedHtml)) fail('Ordem de scripts incorreta no artefato final');
  process.stderr.write('[PetLovePro staging] CSS, catalogo e dados editoriais incluidos e verificados.\n');
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
