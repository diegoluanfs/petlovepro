'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),site=path.join(root,'site-dist');
const catalog=JSON.parse(fs.readFileSync(path.join(site,'catalog-commerce.json'))),metadata=JSON.parse(fs.readFileSync(path.join(site,'site-data.json')));
test('site: 50 livros e 10 coleções liberados com preços esperados',()=>{
 assert.equal(catalog.items.length,60);
 assert.equal(catalog.items.filter(p=>p.kind==='book').length,50);
 assert.equal(catalog.items.filter(p=>p.kind==='collection').length,10);
 assert.equal(catalog.items.filter(p=>p.live).length,60);
 assert.ok(catalog.items.filter(p=>p.kind==='book').every(p=>p.price===2490));
 assert.ok(catalog.items.filter(p=>p.kind==='collection').every(p=>p.price===7990));
 assert.equal(catalog.items.find(p=>p.id==='book-001').price,2490);
 for(const p of catalog.items.filter(x=>!x.live)){assert.equal(p.price,null);assert.ok(!('checkout' in p));}
});
test('site: ofertas privadas nunca entram no diretório público',()=>{
 const files=fs.readdirSync(site);assert.ok(!files.some(x=>/private|firestore-commerce-plan|kiwify-products/.test(x)));
 assert.doesNotMatch(JSON.stringify(catalog),/pay\.kiwify\.com\.br/);
 const legacy=fs.readFileSync(path.join(site,'catalog.js'),'utf8');assert.match(legacy,/book-001/);assert.doesNotMatch(legacy,/pay\.kiwify\.com\.br/);
});
test('site: 50 e-books, 10 coleções, cinco livros em cada coleção',()=>{
 assert.equal(metadata.books.length,50);assert.equal(metadata.collections.length,10);
 const ids=new Set(metadata.books.map(b=>b.id));for(const c of metadata.collections){assert.equal(c.volumes.length,5);assert.equal(new Set(c.volumes).size,5);assert.ok(c.volumes.every(id=>ids.has(id)))}
});
test('site: todas as capas e amostras são reais arquivos válidos',()=>{
 for(let i=1;i<=50;i++){const id=String(i).padStart(3,'0');const c=fs.readFileSync(path.join(site,'assets',`book-${id}.webp`));assert.equal(c.toString('ascii',0,4),'RIFF');const p=fs.readFileSync(path.join(site,'previews',`book-${id}.pdf`));assert.equal(p.toString('ascii',0,5),'%PDF-')}
 for(let i=1;i<=10;i++){const p=path.join(site,'assets',`collection-${String(i).padStart(2,'0')}.webp`);assert.ok(fs.statSync(p).size>1000)}
});
test('site: frontend e páginas legais integrados',()=>{
 const html=fs.readFileSync(path.join(site,'index.html'),'utf8'),js=fs.readFileSync(path.join(site,'app.js'),'utf8');
 for(const part of ['catalog-commerce.js','firebase-config.js','commerce-client.js','app.js'])assert.ok(html.includes(part));
 const client=fs.readFileSync(path.join(site,'commerce-client.js'),'utf8');
 for(const part of ['Comprar na Kiwify','Acessar meu e-book','Minhas compras','Preciso de ajuda com meu acesso','privacidade','viewItem'])assert.ok(js.includes(part),part);
 assert.ok(client.includes('Continuar compra'));
});
const {validWebhookSignature}=require('../src/webhook-signature.cjs');
test('webhook: assinatura HMAC-SHA1 valida raw body e rejeita assinatura incorreta',()=>{
 const token='x'.repeat(48),body=Buffer.from('{"a":1,"b":2}'),sig=crypto.createHmac('sha1',token).update(body).digest('hex');
 assert.equal(validWebhookSignature(body,sig,token),true);
 assert.equal(validWebhookSignature(Buffer.from('{"b":2,"a":1}'),sig,token),false);
 assert.equal(validWebhookSignature(body,sig,'short'),false);
 assert.equal(validWebhookSignature(body,'bad',token),false);
});
const {fromVerifiedKiwifyPayload}=require('../src/kiwify-normalizer.cjs');
test('webhook: rastreamento s1, moeda e loja corretos',()=>{
 const raw={store_id:'zqlEDKV4S2QSt38',order_id:'ord-1',webhook_event_type:'order_approved',Product:{product_id:'prod-1'},Customer:{email:'cliente@example.com'},Commissions:{charge_amount:2490,currency:'BRL'},TrackingParameters:{s1:'x-uuid'}};
 const p=fromVerifiedKiwifyPayload(raw);assert.equal(p.amountCents,2490);assert.equal(p.checkoutIntentId,'x-uuid');assert.equal(p.status,'paid');
 assert.throws(()=>fromVerifiedKiwifyPayload({...raw,store_id:'not-our-store'}),{code:'invalid-store'});
});
