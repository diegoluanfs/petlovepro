#!/usr/bin/env node
'use strict';
/* PetLovePro v1.4.2: reparo conservador do hotfix 43f14f7.
 * Reverte apenas a substituicao indevida de public/app.js e o teste que
 * exigia igualdade entre duas implementacoes com papeis distintos.
 * Nao altera Firestore, Kiwify, PDFs, privacidade ou o workflow.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const resolve = name => path.join(root, name);
const candidate = resolve('public/app.js');
const canonical = resolve('web/app.js');
const badTest = resolve('tests/frontend-firebase-config.test.cjs');
const badBackup = resolve('public/app.js.antes-hotfix.bak');
const backupDir = resolve('.petlovepro-backups');
const packagePath = resolve('package.json');

function stop(message) { throw new Error('[PetLovePro reparo 1.4.2] ' + message); }
function git(args, opts={}) {
  const p=spawnSync('git',args,{cwd:root,encoding:null,maxBuffer:12*1024*1024,...opts});
  if(p.error || p.status!==0) stop('Git falhou em ' + args.slice(0,2).join(' ') + ': ' + String(p.stderr||p.error));
  return p.stdout;
}
function requireFile(file) { if(!fs.existsSync(file))stop('Arquivo ausente: '+path.relative(root,file)); }
function backup(file, suffix) {
  fs.mkdirSync(backupDir,{recursive:true});
  const target=path.join(backupDir,suffix);
  if(fs.existsSync(target))stop('Backup ja existe (preservado): '+target);
  fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);
  return target;
}
function run() {
  for(const f of [candidate,canonical,packagePath,resolve('scripts/stage-cloudflare.cjs'),resolve('scripts/build-site.cjs')])requireFile(f);
  const old=git(['show','43f14f7^:public/app.js']);
  if(!old.includes(Buffer.from('firebaseConfig')))stop('A versao anterior nao contem o modulo esperado. Interrompido.');
  const now=fs.readFileSync(candidate);
  const web=fs.readFileSync(canonical);
  // Git stores LF while Windows checkouts can use CRLF; compare the meaning,
  // not the platform-specific line endings. HEAD also covers an unmodified
  // checkout of the already committed hotfix.
  const normalized = value => value.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const equivalent = (a, b) => normalized(a) === normalized(b);
  const committed = git(['show', 'HEAD:public/app.js']);
  if(!equivalent(now, old) && !equivalent(now, web) && !equivalent(now, committed))
    stop('public/app.js tem alteracoes substantivas fora do hotfix; backup e revisao necessarios.');
  const build=fs.readFileSync(resolve('scripts/build-site.cjs'),'utf8');
  if(!build.includes('PETLOVEPRO_V123_FRONTEND_PRECEDENCE'))stop('Marcador da correcao de prioridade v1.2.3 ausente; nao e seguro prosseguir.');
  // Exigencia de copia explicita da versao canônica após public/.
  const anchor="recursive(path.join(root,'public'),output);";
  const expected="copy(path.join(root,'web/app.js'),path.join(output,'app.js'));";
  if(build.lastIndexOf(expected) < build.indexOf(anchor))stop('A etapa que preserva o web/app.js nao esta depois de public/.');

  if(fs.existsSync(badTest)) {
    const source=fs.readFileSync(badTest,'utf8');
    if(!source.includes('Public app uses the canonical frontend implementation'))stop('O teste do hotfix foi modificado. Preserve-o e revise manualmente.');
  }
  const pkg=JSON.parse(fs.readFileSync(packagePath,'utf8'));
  const command=pkg.scripts?.['check:release'];
  if(!['node scripts/check-release.cjs','node scripts/check-release-verified.cjs'].includes(command))stop('check:release desconhecido: '+JSON.stringify(command));

  if(!equivalent(now, old)) {
    const target=backup(candidate,'public-app-antes-reparo-v142.js');
    fs.writeFileSync(candidate,old);
    console.log('public/app.js restaurado usando o commit anterior a 43f14f7. Backup: '+target);
  } else console.log('public/app.js ja corresponde ao modulo original.');

  if(fs.existsSync(badBackup)) {
    fs.mkdirSync(backupDir,{recursive:true});
    const dest=path.join(backupDir,'public-app-antes-hotfix.bak');
    if(fs.existsSync(dest))stop('Backup em destino ja existe; mova manualmente '+badBackup);
    fs.renameSync(badBackup,dest);
    console.log('Backup movido para fora de public/: '+dest);
  }
  if(fs.existsSync(badTest)) {
    fs.unlinkSync(badTest);
    console.log('Teste incorreto removido (git registrara a exclusao).');
  }
  if(command !== 'node scripts/check-release-verified.cjs') {
    pkg.scripts['check:release']='node scripts/check-release-verified.cjs';
    fs.writeFileSync(packagePath,JSON.stringify(pkg,null,2)+'\n');
    console.log('check:release atualizado para verificar o artefato final de staging.');
  }
  console.log('Reparo aplicado. Ainda e necessario executar todos os testes ANTES do commit.');
}
try { run(); }
catch(e) { console.error(e.message); process.exitCode=1; }
