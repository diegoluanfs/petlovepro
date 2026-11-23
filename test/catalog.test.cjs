const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {readJSON,readKiwifyTSV,compile,validCheckout,auditPrivateRecords}=require('../src/catalog-core.cjs');
const root=path.resolve(__dirname,'..');
const editorial=readJSON(path.join(root,'data/editorial-catalog.json'));
const commercial=readKiwifyTSV(path.join(root,'data/kiwify-products-verified.tsv'));
const release=readJSON(path.join(root,'data/release-policy.json'));
test('catálogo de 60 itens, 50 livros e 10 coleções com cinco livros distintos',()=>{
 const r=compile(editorial,commercial,release);assert.deepEqual(r.issues,[]);
 assert.equal(r.products.filter(x=>x.kind==='book').length,50);
 assert.equal(r.products.filter(x=>x.kind==='collection').length,10);
 assert.ok(r.products.filter(x=>x.kind==='collection').every(c=>new Set(c.volumeIds).size===5));
 assert.deepEqual(auditPrivateRecords(r.products),[]);
});
test('Todos os 60 produtos estão liberados com preços e links oficiais da Kiwify',()=>{
 const r=compile(editorial,commercial,release);
 assert.equal(r.products.length,60);
 assert.equal(r.products.filter(p=>p.live).length,60);
 const book1=r.products.find(p=>p.id==='book-001');
 assert.equal(book1.checkout,'https://pay.kiwify.com.br/gqYNAHL');
 assert.equal(book1.kiwifyProductId,'6fc77560-e344-11f1-adb8-1969287addfd');
 assert.equal(book1.kiwifyOfferId,'571fe8f9-cbfc-4d16-af5b-d29f39014d1a');
 for(const p of r.products){
  assert.equal(p.price,p.kind==='book'?2490:7990);
  assert.ok(p.kiwifyProductId);
  assert.ok(p.kiwifyOfferId);
  assert.ok(validCheckout(p.checkout));
 }
});
const {auditOfficialOffers}=require('../src/kiwify-link-audit.cjs');
const snapshot=readJSON(path.join(root,'data/kiwify-offers-verified.private.json'));
test('Os 60 checkout URLs e IDs de ofertas são únicos e correspondem ao snapshot confirmado',()=>{
 const {products}=compile(editorial,commercial,release);
 assert.deepEqual(auditOfficialOffers(products,release,snapshot),[]);
 assert.equal(new Set(products.map(p=>p.checkout)).size,60);
});
test('Auditoria bloqueia troca de destino de um livro para outro',()=>{
 const {products}=compile(editorial,commercial,release);
 const changed=products.map(x=>({...x}));
 changed[2].checkout=changed[1].checkout;
 assert.ok(auditOfficialOffers(changed,release,snapshot).some(x=>x.includes('checkout não corresponde')));
});
test('não permite URL externa/HTTP maliciosa',()=>{
 assert.equal(validCheckout('http://pay.kiwify.com.br/gqYNAHL'),false);
 assert.equal(validCheckout('https://pay.kiwify.com.br.evil.com/gqYNAHL'),false);
 assert.equal(validCheckout('https://pay.kiwify.com.br/gqYNAHL'),true);
});
test('bloqueia preços divergentes em item liberado',()=>{
 const manipulated=commercial.map(x=>({...x}));
 manipulated.find(x=>x.title==='Receitas Naturais Saudáveis para Pets').priceCents=2990;
 const r=compile(editorial,manipulated,release);
 assert.ok(r.issues.some(x=>x.includes('Receitas naturais saudáveis para pets: preço Kiwify')));
 assert.equal(r.products.find(x=>x.id==='book-001').live,false);
});
test('auditoria detecta regressão de item lançado para em breve',()=>{
 const now=compile(editorial,commercial,{...release,releaseOnly:[],productCheckoutUrls:{}} ,[{id:'book-001',title:'Livro 001',live:true}]);
 assert.ok(now.issues.some(x=>x.includes('REGRESSÃO')));
});
test('identifica coleções adulteradas',()=>{
 const modified=structuredClone(editorial);
 modified.collections[0].volumes=['book-001','book-002','book-002','book-004','book-005'];
 assert.ok(compile(modified,commercial,release).issues.some(x=>x.includes('cinco livros distintos')));
});
