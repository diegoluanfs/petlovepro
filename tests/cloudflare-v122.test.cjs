'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const path=require('node:path');
const {allowedFile,validatePreviews,validateOnlyApprovedAdditionalEntries}=require('../scripts/cloudflare-public-v122.cjs');
const base=path.resolve(__dirname,'../public');
test('v122: as 60 capas e 50 amostras permitidas por nome',()=>{
  for(let i=1;i<=50;i++){
    const suffix=String(i).padStart(3,'0');
    assert.equal(allowedFile(`assets/book-${suffix}.webp`),true);
    assert.equal(allowedFile(`previews/book-${suffix}.pdf`),true);
  }
  for(let i=1;i<=10;i++)assert.equal(allowedFile(`assets/collection-${String(i).padStart(2,'0')}.webp`),true);
  validatePreviews(base);
});
test('v122: acesso a segredo e PDFs completos continua proibido',()=>{
  for(const key of ['private/ebook.pdf','previews/book-001.epub','previews/book-051.pdf','assets/book-051.webp','assets/private.pdf','firebase-adminsdk.json','.env','data/orders.json']){
    assert.equal(allowedFile(key),false,key);
  }
  assert.throws(()=>validateOnlyApprovedAdditionalEntries(()=>{throw Error('Arquivo não autorizado: assets/book-001.webp\nArquivo não autorizado: private.pdf');},path.join(__dirname,'../scripts')),/private.pdf/);
});
test('v122: problemas desconhecidos NÃO são ignorados',()=>{
  assert.throws(()=>validateOnlyApprovedAdditionalEntries(()=>{throw Error('Erro desconhecido');},path.join(__dirname,'../scripts')),/Erro desconhecido/);
  assert.doesNotThrow(()=>validateOnlyApprovedAdditionalEntries(()=>{throw Error('Arquivo não autorizado: assets/book-001.webp\nArquivo não autorizado: assets/collection-10.webp\nDiretório não permitido: previews');},path.join(__dirname,'../scripts')));
});
