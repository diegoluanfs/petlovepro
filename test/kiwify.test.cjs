const test=require('node:test');const assert=require('node:assert/strict');
const {fromVerifiedKiwifyPayload}=require('../src/kiwify-normalizer.cjs');
const event={store_id:'zqlEDKV4S2QSt38',order_id:'orderA',order_status:'paid',webhook_event_type:'order_approved',updated_at:'2026-11-20T10:00:00-03:00',
 Product:{product_id:'6fc77560-e344-11f1-adb8-1969287addfd'},Customer:{email:'buyer@test.com'},Commissions:{charge_amount:2490}};
test('normaliza compra aprovada do formato oficial da Kiwify',()=>{
 const x=fromVerifiedKiwifyPayload(event);assert.equal(x.eventId,'orderA:order_approved');
 assert.equal(x.status,'paid');assert.equal(x.amountCents,2490);
});
test('Pix criado registra pendência, sem marcar compra aprovada',()=>{
 const x=fromVerifiedKiwifyPayload({...event,order_status:'waiting_payment',webhook_event_type:'pix_created'});
 assert.equal(x.status,'pix_pending');
});
test('reembolso atualiza status e utiliza mesmo pedido',()=>{
 const x=fromVerifiedKiwifyPayload({...event,order_status:'refunded',webhook_event_type:'order_refunded'});
 assert.equal(x.status,'refunded');assert.equal(x.orderId,'orderA');
});
test('evento de carrinho sem dados de pedido é rejeitado',()=>{
 assert.throws(()=>fromVerifiedKiwifyPayload({store_id:'zqlEDKV4S2QSt38',abandoned_checkout:true}),{code:'ignored-event'});
});
