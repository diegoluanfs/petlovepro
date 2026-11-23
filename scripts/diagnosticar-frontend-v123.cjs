#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'site-dist');
const cases=[
 {file:'index.html',tokens:['catalog-commerce.js','firebase-config.js','commerce-client.js','app.js']},
 {file:'app.js',tokens:['Comprar na Kiwify','Acessar meu e-book','Minhas compras','Preciso de ajuda com meu acesso','privacidade','viewItem']},
 {file:'commerce-client.js',tokens:['Continuar compra']}
];
let bad=0;
for(const {file,tokens} of cases){const p=path.join(dist,file);if(!fs.existsSync(p)){console.error('AUSENTE:',path.relative(root,p));bad++;continue}const contents=fs.readFileSync(p,'utf8');for(const t of tokens){if(!contents.includes(t)){console.error('FALTA EM site-dist/'+file+': '+t);bad++;}}}
for(const f of ['index.html','app.js']){
 const legacy=path.join(root,'public',f);if(fs.existsSync(legacy))console.log('Colisao identificada: public/'+f+' pode sobrescrever o frontend no build antigo.');
}
console.log(bad===0?'Frontend integrado: arquivos e marcadores essenciais encontrados.':bad+' problema(s) no frontend compilado.');
process.exitCode=bad?1:0;
