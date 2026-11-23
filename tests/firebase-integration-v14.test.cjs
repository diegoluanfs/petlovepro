'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {processAnalyticsOutbox,decisionFor}=require('../functions-petlovepro/lib/ga4-outbox.cjs');
const {webhookFailureStatus}=require('../functions-petlovepro/lib/webhook-http-policy.cjs');
const {makeFirebaseCommerceStore}=require('../functions-petlovepro/lib/firebase-adapter.cjs');
const {auditSite}=require('../src/preflight-commerce-core.cjs');
const {probe}=require('../scripts/probe-commerce-webhook.cjs');
const {fromVerifiedKiwifyPayload,STORE_ID}=require('../functions-petlovepro/lib/kiwify-normalizer.cjs');
const VALID={status:'queued',attempts:0,orderId:'order-123',catalogId:'book-001',
 amountCents:2490,productTitle:'Receitas Naturais',analyticsConsent:true,ga4ClientId:'1234.5678'};
function fakeOutbox(original){
 let value=original&&structuredClone(original);
 const ref={path:'commerceAnalyticsOutbox/order-123'};
 const db={async runTransaction(fn){
   const tx={
     async get(){return {exists:!!value,data:()=>structuredClone(value)}} ,
     update(_ref,fields){value={...value,...fields}}
   };
   return fn(tx);
 }};
 return {ref,db,read:()=>structuredClone(value)};
}
const args=(f,send,now=1000000)=>({...f,send,now:()=>now,randomId:()=>`lease-${now}`,
  secret:'test-secret',measurementId:'G-K2CLX0L79J'});

test('v1.4: GA4 envia e finaliza usando transaction_id estável',async()=>{
 const f=fakeOutbox(VALID);let calls=0;
 const result=await processAnalyticsOutbox(args(f,async ({order})=>{
   assert.equal(order.orderId,'order-123');calls++;return {sent:true};}));
 assert.equal(result.status,'sent');assert.equal(f.read().status,'sent');
 assert.equal(f.read().transactionId,'order-123');assert.equal(calls,1);
 await processAnalyticsOutbox(args(f,()=>{throw Error('Não reenviar')}));
 assert.equal(calls,1);
});
test('v1.4: falha HTTP do GA4 volta para retry e pode recuperar',async()=>{
 const f=fakeOutbox(VALID);let calls=0;
 await assert.rejects(processAnalyticsOutbox(args(f,async()=>{calls++;throw Error('network')})),/network/);
 assert.equal(f.read().status,'retry');assert.equal(f.read().attempts,1);
 await processAnalyticsOutbox(args(f,async()=>{calls++;return {sent:true}},1000100));
 assert.equal(f.read().status,'sent');assert.equal(f.read().attempts,2);assert.equal(calls,2);
});
test('v1.4: uma execução que caiu no estado sending expira lease e reprocessa',async()=>{
 const f=fakeOutbox({...VALID,status:'sending',leaseToken:'old-token',lastAttemptAt:1,attempts:1});
 await processAnalyticsOutbox(args(f,async()=>({sent:true})));
 assert.equal(f.read().status,'sent');assert.equal(f.read().attempts,2);
});
test('v1.4: lease recente não finaliza evento e pede nova retentativa',async()=>{
 const f=fakeOutbox({...VALID,status:'sending',leaseToken:'working',lastAttemptAt:999900,attempts:1});
 await assert.rejects(processAnalyticsOutbox(args(f,async()=>({sent:true}))),/lease still active/);
 assert.equal(f.read().status,'sending');
});
test('v1.4: limite de tentativas finaliza como falha operacional',async()=>{
 const f=fakeOutbox({...VALID,status:'retry',attempts:8});
 const r=await processAnalyticsOutbox(args(f,()=>{throw Error('não enviar')}));
 assert.equal(r.status,'exhausted');assert.equal(f.read().status,'failed');
});
test('v1.4: consentimento ausente não envia Purchase',async()=>{
 const f=fakeOutbox({...VALID,analyticsConsent:false});
 const r=await processAnalyticsOutbox(args(f,()=>{throw Error('não enviar')}));
 assert.equal(r.status,'skipped');assert.equal(f.read().status,'skipped');
});
test('v1.4: payload adulterado não envia e falha permanentemente',async()=>{
 const f=fakeOutbox({...VALID,catalogId:'path/to/secret'});
 const r=await processAnalyticsOutbox(args(f,()=>{throw Error('não enviar')}));
 assert.equal(r.status,'failed');assert.equal(f.read().error,'invalid-outbox-payload');
});
test('v1.4: status desconhecido falha e não é tratado como sucesso',async()=>{
 const f=fakeOutbox({...VALID,status:'something-else'});
 await assert.rejects(processAnalyticsOutbox(args(f,()=>{throw Error('não enviar')})),/status invalid/);
});
test('v1.4: decisão de lease usa estado existente',()=>{
 assert.equal(decisionFor({status:'sent'},100),'terminal');
 assert.equal(decisionFor({status:'sending',lastAttemptAt:100,attempts:1},200),'busy');
 assert.equal(decisionFor({status:'sending',lastAttemptAt:100,attempts:1},200000),'claim');
});
function fakeCommerceDb({order={},duplicate=true}={}){
 const changed=[];const db={
  collection(name){return {doc(id){return {path:name+'/'+id,collection(n){return {doc(k){return {path:name+'/'+id+'/'+n+'/'+k}}}}}}}},
  async runTransaction(fn){
   return fn({async get(ref){if(ref.path==='commerceOrders/abc')return {exists:!!order,data:()=>order};
       if(ref.path==='commerceWebhookEvents/abc:order_approved')return {exists:duplicate,data:()=>({})};
       return {exists:false,data:()=>null};},
    set(ref,v){changed.push({ref,v})},create(ref,v){changed.push({ref,v})}})
  },changed
 };return db;
}
const signedEvent={orderId:'abc',eventId:'abc:order_approved',status:'approved',
  catalogId:'book-001',productId:'kiwify-p1',productTitle:'Livro 001',email:'buyer@test.com',
  uid:'uid-1',at:'2026-11-23T00:00:00Z',amountCents:2490};
test('v1.4: webhook duplicado retorna uid e repara biblioteca sem regravar pedido',async()=>{
 const db=fakeCommerceDb({order:{...signedEvent,uid:'uid-1'},duplicate:true});
 const r=await makeFirebaseCommerceStore(db).atomicSave(signedEvent);
 assert.equal(r.duplicate,true);assert.equal(r.uid,'uid-1');assert.equal(r.orderId,'abc');
 assert.deepEqual(db.changed,[]);
});
test('v1.4: conflito entre dois UIDs não escreve outra conta',async()=>{
 const db=fakeCommerceDb({order:{...signedEvent,uid:'uid-original',kiwifyProductId:'kiwify-p1',emailLower:'buyer@test.com'},duplicate:false});
 await assert.rejects(makeFirebaseCommerceStore(db).atomicSave({...signedEvent,uid:'uid-different'}),e=>e.code==='order-conflict');
 assert.deepEqual(db.changed,[]);
});
test('v1.4: orderId malicioso não entra no caminho Firestore',async()=>{
 const db=fakeCommerceDb({order:{},duplicate:false});
 await assert.rejects(makeFirebaseCommerceStore(db).atomicSave({...signedEvent,orderId:'x/../../secret'}),e=>e.code==='invalid-event');
});
test('v1.4: payload Kiwify oficial em centavos continua compatível',()=>{
 const r=fromVerifiedKiwifyPayload({store_id:STORE_ID,webhook_event_type:'order_approved',order_id:'purchase-1',
  Product:{product_id:'external-p1'},Customer:{email:'buyer@test.com'},
  Commissions:{charge_amount:'2490',currency:'BRL'},TrackingParameters:{s1:'a'}});
 assert.equal(r.amountCents,2490);assert.equal(r.status,'paid');
});
test('v1.4: erros permanentes do webhook exigem revisão; infraestrutura pode repetir',()=>{
 for(const code of ['invalid-event','invalid-store','currency-mismatch','unmapped-product','order-conflict'])
  assert.equal(webhookFailureStatus({code}),422);
 assert.equal(webhookFailureStatus({code:'UNAVAILABLE'}),500);
});
function fakeSiteFetch(u){
 const pathname=new URL(u).pathname;
 const json=x=>JSON.stringify(x);
 const files={
 '/':'<script src="commerce-client.js"></script><script src="app.js"></script>',
 '/app.js':'enableGA4 function commerceBeginCheckout commerceGetAccount',
 '/commerce-client.js':'beginCheckout hasAnalyticsConsent',
 '/catalog-commerce.json':json({items:[...Array.from({length:50},(_,i)=>({id:`book-${String(i+1).padStart(3,'0')}`,kind:'book',live:true,price:2490})),...Array.from({length:10},(_,i)=>({id:`collection-${String(i+1).padStart(2,'0')}`,kind:'collection',live:true,price:7990}))]}),
 '/seller-public.json':json({analyticsMeasurementId:'G-K2CLX0L79J',supportEmail:'help@example.com',legalName:'PetLovePro'}),
 '/firebase-config.js':'projectId: "petlovepro-ae222", functionsRegion: "us-central1"'
 };
 return Promise.resolve(new Response(files[pathname]||'',{status:files[pathname]?200:404}));
}
test('v1.4: preflight somente leitura identifica site integrado',async()=>{
 const r=await auditSite('https://petlovepro.com.br',fakeSiteFetch);
 assert.equal(r.ok,true);assert.equal(r.failures.length,0);
});
test('v1.4: preflight detecta catálogo incompleto',async()=>{
 const f=async u=>{if(new URL(u).pathname==='/catalog-commerce.json')return new Response(JSON.stringify({items:[]}));return fakeSiteFetch(u)};
 const r=await auditSite('https://petlovepro.com.br',f);
 assert.equal(r.ok,false);assert.ok(r.failures.includes('60-produtos'));
});
test('v1.4: probe HTTP nunca envia assinatura válida nem compra',async()=>{
 const requests=[];
 const f=async(u,opts)=>{requests.push(opts);return new Response('',{status:opts.method==='GET'?405:401})};
 const r=await probe('https://site.example/webhook',f);
 assert.equal(r.ok,true);assert.deepEqual(requests.map(x=>x.method),['GET','POST']);
 assert.ok(!requests.some(x=>x.headers?.Authorization||x.body?.includes('order_approved')));
});

test('v1.4: evento de diagnóstico assinado não contém compra nem escreve no Firestore',async()=>{
 const calls=[];
 const f=async (u,opts)=>{
   calls.push({url:String(u),method:opts.method,body:opts.body});
   return new Response('',{status:opts.method==='GET'?405:(String(u).includes('signature=')?200:401)});
 };
 const result=await probe('https://site.example/kiwifyCommerceWebhookV2',f,{signedToken:'a'.repeat(40)});
 assert.equal(result.ok,true);assert.equal(calls.length,3);
 assert.equal(JSON.parse(calls[2].body).webhook_event_type,'plp_diagnostic');
 assert.ok(!('order_id' in JSON.parse(calls[2].body)));
 assert.equal(new URL(calls[2].url).searchParams.get('signature').length,40);
});
const {aggregateCommerceStatus}=require('../src/commerce-status-core.cjs');
test('v1.4: auditoria de produção só agrega estados, sem PII',()=>{
 const rows={commercialProducts:[{kind:'book',live:true,offerActive:true}],
 commerceOrders:[{uid:'secret-uid',emailLower:'buyer@example.com',status:'approved'}],
 commerceAnalyticsOutbox:[{status:'sending',lastAttemptAt:1,ga4ClientId:'secret-123'}]};
 const info=aggregateCommerceStatus(rows,{now:1_000_000,sampleLimit:100});
 assert.ok(info.alerts.some(x=>x.includes('sending')));
 assert.equal(info.collections.commerceOrders.statuses.approved,1);
 assert.doesNotMatch(JSON.stringify(info),/buyer@example.com|secret-uid|secret-123/);
});
test('v1.4: webhook repetido vincula pedido antigo sem uid após verificação',async()=>{
 const db=fakeCommerceDb({order:{...signedEvent,uid:null},duplicate:true});
 const r=await makeFirebaseCommerceStore(db).atomicSave(signedEvent);
 assert.equal(r.uid,'uid-1');assert.equal(r.duplicate,true);
 assert.equal(db.changed.length,2);
 assert.equal(db.changed[0].v.uid,'uid-1');
 assert.equal(db.changed[1].v.uid,'uid-1');
});
