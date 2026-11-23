#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const project=path.join(__dirname,'..');
const packageData=require(path.join(project,'package.json'));
const firebase=require(path.join(project,'firebase.petlovepro.json'));
const policy=require(path.join(project,'data/release-policy.json'));
const issues=[];
if(firebase.hosting.site!=='petlovepro-ae222')issues.push('Destino do hosting inesperado');
if(firebase.hosting.public!=='site-dist')issues.push('Hosting fora da pasta pública');
if(firebase.firestore)issues.push('Firestore não deve ser publicado pela configuração isolada');
if(policy.releaseOnly.length!==60||new Set(policy.releaseOnly).size!==60)issues.push('Esperados 60 itens liberados sem repetição');
const content=fs.readFileSync(path.join(project,'public/firebase-config.js'),'utf8');
if(!content.includes('petlovepro-ae222')||!content.includes('G-K2CLX0L79J'))issues.push('Configuração Firebase Web divergente');
for(const name of ['index.html','public/assets/book-001.webp','public/assets/book-050.webp','public/previews/book-001.pdf','site-dist/catalog.js']){
 if(!fs.existsSync(path.join(project,name)))issues.push('Arquivo faltando: '+name);
}
console.log('PetLovePro '+packageData.version+' | Projeto Firebase: petlovepro-ae222');
console.log('Hospedagem isolada: '+firebase.hosting.public);
console.log('Política de liberação: '+policy.releaseOnly.length+' produtos habilitados (50 livros + 10 coleções).');
console.log('Não publicar dados privados; nenhuma mudança no Firebase foi executada.');
if(issues.length){issues.forEach(x=>console.error('ERRO:',x));process.exit(1)}
console.log('Pré-verificação estática OK; publicar depende de homologação e aprovação legal.');
