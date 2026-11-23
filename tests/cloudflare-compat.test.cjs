'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path');
const {allowedFile,runWithApprovedPublicExtras,assertAllowedPreviewDir}=require('../scripts/cloudflare-public-compat.cjs');
test('cloudflare compat: somente 60 capas oficiais permitidas',()=>{
 for(let i=1;i<=50;i++)assert.equal(allowedFile(`assets/book-${String(i).padStart(3,'0')}.webp`),true);
 for(let i=1;i<=10;i++)assert.equal(allowedFile(`assets/collection-${String(i).padStart(2,'0')}.webp`),true);
 for(const p of ['assets/book-000.webp','assets/book-051.webp','assets/collection-00.webp','assets/collection-11.webp','assets/secret.pdf','data/private.json','functions/index.js','.env'])assert.equal(allowedFile(p),false,p);
});
test('cloudflare compat: 50 PDFs de prévia nomeados corretamente',()=>{
 for(let i=1;i<=50;i++)assert.equal(allowedFile(`previews/book-${String(i).padStart(3,'0')}.pdf`),true);
 for(const p of ['previews/book-000.pdf','previews/book-051.pdf','previews/book-001.txt','previews/../../secret.pdf','previews/book-001.PDF'])assert.equal(allowedFile(p),false,p);
 const publicDir=path.resolve(__dirname,'../public');assertAllowedPreviewDir(publicDir);
});
test('cloudflare compat: proíbe arquivo desconhecido mesmo em erro agregado',()=>{
 const root=path.resolve(__dirname,'../scripts');
 assert.throws(()=>runWithApprovedPublicExtras(()=>{throw Error('Arquivo não autorizado: favicon.svg\nArquivo não autorizado: private-key.json')},root),/private-key.json/);
 assert.throws(()=>runWithApprovedPublicExtras(()=>{throw Error('Diretório não permitido: previews\nDiretório não permitido: accounts')},root),/accounts/);
 assert.doesNotThrow(()=>runWithApprovedPublicExtras(()=>{throw Error('Arquivo não autorizado: assets/collection-10.webp\nDiretório não permitido: previews')},root));
});
