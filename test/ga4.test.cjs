const test=require('node:test');const assert=require('node:assert/strict');
const {purchasePayload,sendGA4Purchase}=require('../src/ga4-core.cjs');
const order={orderId:'test-101',catalogId:'book-001',productTitle:'Receitas Naturais Saudáveis para Pets',amountCents:2490};
test('sem consentimento não transmite compra para GA4',async()=>{
 const out=await sendGA4Purchase({order,clientId:'1.2',consentGranted:false,measurementId:'G-K2CLX0L79J',apiSecret:'fake',fetchImpl:()=>{throw Error('não deve enviar')}});
 assert.equal(out.skipped,true);
});
test('quando autorizado envia purchase com transaction_id estável',async()=>{
 const seen=[];const result=await sendGA4Purchase({order,clientId:'111.222',consentGranted:true,measurementId:'G-K2CLX0L79J',apiSecret:'FAKE_TEST_ONLY',
   fetchImpl:async(u,o)=>{seen.push({u,o});return {ok:true,status:204};}});
 assert.equal(result.transactionId,'test-101');assert.equal(seen.length,1);
 const body=JSON.parse(seen[0].o.body);
 assert.equal(body.events[0].params.transaction_id,'test-101');
 assert.equal(body.events[0].params.value,24.9);assert.equal(body.events[0].params.currency,'BRL');
});
