const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const file=n=>path.join(root,n);
test('Firebase real da PetLovePro configurado no app Web',()=>{
 const js=fs.readFileSync(file('public/firebase-config.js'),'utf8');
 for(const item of ['petlovepro-ae222','G-K2CLX0L79J','340581221398'])assert.ok(js.includes(item));
});
test('Configuração isolada não muda regras Firestore',()=>{
 const cfg=JSON.parse(fs.readFileSync(file('firebase.petlovepro.json'),'utf8'));
 assert.equal(cfg.hosting.site,'petlovepro-ae222');
 assert.equal(cfg.hosting.public,'site-dist');
 assert.equal(cfg.firestore,undefined);
 assert.equal(cfg.functions[0].source,'functions-petlovepro');
});
test('50 livros e 10 coleções liberados com mapa comercial',()=>{
 const policy=JSON.parse(fs.readFileSync(file('data/release-policy.json'),'utf8'));
 assert.equal(policy.releaseOnly.length,60);
 assert.equal(new Set(policy.releaseOnly).size,60);
 assert.equal(policy.productCheckoutUrls['book-001'],'https://pay.kiwify.com.br/gqYNAHL');
});
test('Arquivo público não contém as ofertas privadas',()=>{
 const publicFile=fs.readFileSync(file('site-dist/catalog-commerce.json'),'utf8');
 assert.equal(publicFile.includes('gqYNAHL'),false);
 assert.equal(publicFile.includes('kiwifyOfferId'),false);
});
