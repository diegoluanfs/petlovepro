#!/usr/bin/env node
'use strict';
/* Valida o MESMO staging da Cloudflare que o site utiliza, falhando fechado
 * quando o app principal nao for byte-a-byte igual ao web/app.js vigente.
 * Nao altera o catalogo nem ignora itens nao autorizados.
 */
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'petlovepro-validate-v142-'));
const destination=path.join(tmp,'staging');
function fail(msg){throw new Error('[PetLovePro CI] '+msg);}
function findDeployRoots(dir,depth=0){
  if(depth>6)return [];
  const entries=fs.readdirSync(dir,{withFileTypes:true});
  const names=new Set(entries.map(x=>x.name));
  const found=[];
  if(names.has('index.html') && names.has('app.js') && names.has('firebase-config.js'))found.push(dir);
  for(const entry of entries){
    if(entry.isSymbolicLink())fail('Link simbolico proibido na pasta temporaria: '+entry.name);
    if(entry.isDirectory())found.push(...findDeployRoots(path.join(dir,entry.name),depth+1));
  }
  return found;
}
function run(){
  fs.mkdirSync(destination,{recursive:true});
  console.log('Gerando staging com o validador original...');
  const result=spawnSync(process.execPath,[path.join(root,'scripts/stage-cloudflare-canonical.cjs'),destination],
    {cwd:root,stdio:'inherit',maxBuffer:12*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0)fail('staging recusado pelo validador da Cloudflare ('+(result.status??'signal')+').');
  const roots=findDeployRoots(destination);
  if(roots.length!==1)fail('Esperado exatamente um staging com index.html, app.js e firebase-config.js. Encontrados: '+roots.length);
  const stage=roots[0];
  const expected=fs.readFileSync(path.join(root,'web/app.js'));
  const built=fs.readFileSync(path.join(root,'site-dist/app.js'));
  const staged=fs.readFileSync(path.join(stage,'app.js'));
  if(!built.equals(expected))fail('site-dist/app.js diverge de web/app.js; executar o build canônico.');
  if(!staged.equals(expected))fail('O app.js que sera publicado diverge de web/app.js. Deploy impedido.');
  const html=fs.readFileSync(path.join(stage,'index.html'),'utf8');
  const conf=html.indexOf('/firebase-config.js');
  const app=html.indexOf('/app.js');
  if(conf<0 || app<0 || conf>=app)fail('HTML nao carrega firebase-config.js antes de app.js.');
  const firebase=fs.readFileSync(path.join(stage,'firebase-config.js'),'utf8');
  if(!firebase.includes('PETLOVEPRO_FIREBASE'))fail('Configuracao Firebase global nao encontrada.');
  if(/\bexport\s+(?:const|default|\{)/.test(firebase))fail('Firebase config e script classico, mas tem exportacao de modulo.');
  console.log('OK: staging isolado aprovado; app.js byte-a-byte igual a web/app.js.');
  console.log('OK: configuracao Firebase global carregada antes da aplicacao.');
}
try { run(); }
catch(error){ console.error(error.message);process.exitCode=1; }
finally { fs.rmSync(tmp,{recursive:true,force:true}); }
