#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const stageFile=path.join(ROOT,'scripts','stage-cloudflare.cjs');
const buildFile=path.join(ROOT,'scripts','build-site.cjs');
const pkgFile=path.join(ROOT,'package.json');
const htmlFile=path.join(ROOT,'index.html');
const sentry='/* PETLOVEPRO_CLOUDFLARE_ALLOWED_EXTRAS_V121 */';
const argv=new Set(process.argv.slice(2));
const dry=argv.has('--check');
const report=[];
function writeBackup(file,txt){const back=file+'.antes-petlovepro-v121.bak';if(!fs.existsSync(back)){if(!dry)fs.copyFileSync(file,back);report.push('Backup: '+path.relative(ROOT,back));} if(!dry)fs.writeFileSync(file,txt,'utf8');}
function precondition(test,msg){if(!test)throw Error(msg)}
precondition(fs.existsSync(stageFile),'Não encontrei scripts/stage-cloudflare.cjs: nada foi alterado.');
precondition(fs.existsSync(buildFile),'Não encontrei scripts/build-site.cjs. Extraia primeiro a aplicação PetLovePro v1.2.0.');
precondition(fs.existsSync(pkgFile)&&fs.existsSync(htmlFile),'package.json ou index.html ausente.');
let src=fs.readFileSync(stageFile,'utf8');
if(!src.includes(sentry)){
  // Patch only the original assertion CALL, never the validator itself.
  const start=src.search(/(?:function\s+stageCloudflare\s*\(|\b(?:const|let)\s+stageCloudflare\s*=)/);
  precondition(start>=0,'Não encontrei declaração reconhecível de stageCloudflare(). Arquivo legado preservado.');
  const tail=src.slice(start);
  const m=/\bassertPublic\s*\(\s*([^;()]*)\s*\)\s*;?/.exec(tail);
  precondition(m,'Não encontrei a chamada assertPublic(...) dentro de stageCloudflare(). Arquivo preservado.');
  const expr=m[0].replace(/;\s*$/,'');
  const wrapper=`${sentry}\n  require('./cloudflare-public-compat.cjs').runWithApprovedPublicExtras(() => ${expr}, __dirname);`;
  src=src.slice(0,start+m.index)+wrapper+src.slice(start+m.index+m[0].length);
  precondition(src.includes(sentry),'Falha ao preparar substituição de stage-cloudflare.');
  // Parse the modified script using node --check BEFORE writing.
  const tmp=path.join(ROOT,'scripts','.stage-cloudflare-v121-check.cjs');
  try{fs.writeFileSync(tmp,src,'utf8');cp.execFileSync(process.execPath,['--check',tmp],{stdio:'pipe'});}catch(e){throw Error('A nova sintaxe não passou na validação; o arquivo original está intacto. '+(e.stderr||e.message));}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}
  report.push('Adicionada extensão estrita à validação do Cloudflare; validador legado preservado');
  writeBackup(stageFile,src);
}else report.push('Cloudflare já possui correção v1.2.1; nenhuma duplicação');

let html=fs.readFileSync(htmlFile,'utf8');
precondition(html.includes('id="app"'),'O index.html atual não contém a aplicação PetLovePro v1.2: alterações canceladas.');
const tags=['firebase-config.js','catalog-commerce.js','commerce-client.js','app.js'];
const missing=tags.filter(tag=>!html.includes(`src="/${tag}"`) && !html.includes(`src='/${tag}'`));
if(missing.length){
 precondition(html.includes('</head>'),'Fechamento </head> ausente no HTML.');
 html=html.replace('</head>',missing.map(tag=>`  <script src="/${tag}" defer></script>`).join('\n')+'\n</head>');
 report.push('Atualizados scripts no HTML: '+missing.join(', '));
 writeBackup(htmlFile,html);
}else report.push('HTML da PetLovePro já inclui todos os 4 scripts');
const pkg=JSON.parse(fs.readFileSync(pkgFile,'utf8'));
precondition(pkg.scripts?.build?.includes('build-site.cjs'),'O script npm build não é da PetLovePro v1.2; preservado.');
const originalTest=pkg.scripts?.test||'';
precondition(originalTest.includes('node --test'),'Não reconheci npm test: preservado.');
// The original Cloudflare staging test may replace/modify the same output while
// the newer frontend test reads it. Run groups separately and rebuild in between.
const safeTest='node --test test/*.test.cjs && node scripts/build-site.cjs && node --test tests/*.test.cjs';
if(originalTest!==safeTest || pkg.scripts.pretest!=='node scripts/build-site.cjs'){
 pkg.scripts.pretest='node scripts/build-site.cjs';pkg.scripts.test=safeTest;
 report.push('npm test agora executa testes legados, reconstrói a vitrine e executa os novos testes');
 writeBackup(pkgFile,JSON.stringify(pkg,null,2)+'\n');
}else report.push('npm test já corrigido');
console.log((dry?'[Verificação] ':'[Correção] ')+report.join('\n'));
if(!dry)console.log('Próximo comando: npm run verify');
