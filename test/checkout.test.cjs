const test=require('node:test');const assert=require('node:assert/strict');
const {resolveCheckout,CommerceError,mapId,formatOrder}=require('../src/commerce-core.cjs');
const book={id:'book-001',title:'Receitas Naturais Saudáveis para Pets',kind:'book',price:2490,
 offerPriceCents:2490,currency:'BRL',live:true,offerActive:true,offerVerified:true,
 kiwifyOfferId:'571fe8f9-cbfc-4d16-af5b-d29f39014d1a',kiwifyProductId:'6fc77560-e344-11f1-adb8-1969287addfd',
 checkout:'https://pay.kiwify.com.br/gqYNAHL'};
const user={uid:'test-user',email:'Buyer@Example.COM',emailVerified:true};
function setup(p=book){const records=[];return {args:{user,productId:'001',store:{getProduct:async id=>id==='book-001'?p:null},createIntent:async intent=>{records.push(intent);}},records};}
test('checkout retorna URL real e registra intenção para mesma pessoa e produto',async()=>{
 const {args,records}=setup();const out=await resolveCheckout(args);
 assert.equal(out.priceCents,2490);assert.equal(new URL(out.checkoutUrl).origin+new URL(out.checkoutUrl).pathname,book.checkout);
 assert.equal(new URL(out.checkoutUrl).searchParams.get('s1'),records[0].id);
 assert.equal(out.productId,'book-001');assert.equal(records.length,1);
 assert.equal(records[0].emailLower,'buyer@example.com');
});
test('checkout exige autenticação e e-mail verificado',async()=>{
 await assert.rejects(resolveCheckout({...setup().args,user:null}),{code:'auth-required'});
 await assert.rejects(resolveCheckout({...setup().args,user:{...user,emailVerified:false}}),{code:'email-unverified'});
});
test('checkout recusado para item não liberado',async()=>{
 await assert.rejects(resolveCheckout({...setup({...book,live:false}).args}),{code:'not-released'});
});
test('checkout recusado se oferta desligada ou preço diferente',async()=>{
 await assert.rejects(resolveCheckout({...setup({...book,offerActive:false}).args}),{code:'offer-unavailable'});
 await assert.rejects(resolveCheckout({...setup({...book,offerPriceCents:2990}).args}),{code:'price-mismatch'});
 await assert.rejects(resolveCheckout({...setup({...book,checkout:'https://evil.example/buy'}).args}),{code:'invalid-offer'});
});
test('caminho do pedido aprovado e do Pix pendente',()=>{
 const member='https://dashboard.kiwify.com.br/courses';
 assert.equal(formatOrder({status:'pending',catalogId:'book-001',orderId:'p1'},member).accessLabel,null);
 const approved=formatOrder({status:'approved',catalogId:'book-001',orderId:'p1'},member);
 assert.equal(approved.accessLabel,'Acessar meu e-book');
 assert.match(approved.instructions,/Anexos/);
 assert.equal(formatOrder({status:'approved',catalogId:'collection-01'},member).accessLabel,'Acessar meus 5 e-books');
});
test('mapId aceita slug e ID legado sem aceitar caminho arbitrário',()=>{
 assert.equal(mapId('001'),'book-001');assert.equal(mapId('book-001'),'book-001');
 assert.throws(()=>mapId('../orders'),CommerceError);
});
