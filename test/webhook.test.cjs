const test=require('node:test');const assert=require('node:assert/strict');
const {reconcileVerifiedEvent,mergeOrder,normalizeVerifiedEvent,analyticsPurchase}=require('../src/commerce-core.cjs');
const product={id:'book-001',title:'Receitas Naturais Saudáveis para Pets',currency:'BRL',kiwifyProductId:'6fc77560-e344-11f1-adb8-1969287addfd'};
const base={orderId:'order-100',kiwifyProductId:product.kiwifyProductId,customerEmail:'Buyer@example.com',amountCents:2490,currency:'BRL'};
function fake(){const orders=new Map(),events=new Set(),outbox=new Map();return {
 orders,events,outbox,adapter:{getProductByKiwifyId:async id=>id===product.kiwifyProductId?product:null,
 resolveVerifiedUID:async email=>email==='buyer@example.com'?'uid-001':null,
 atomicSave:async event=>{if(events.has(event.eventId))return {duplicate:true};
   const old=orders.get(event.orderId);const merged=mergeOrder(old,event);
   events.add(event.eventId);orders.set(event.orderId,merged.updated);
   if(merged.emitPurchase&&!outbox.has(event.orderId))outbox.set(event.orderId,analyticsPurchase(merged.updated));
   return {duplicate:false,status:merged.updated.status};}}};}
test('Pix pendente -> aprovado -> reembolso, com histórico único',async()=>{
 const db=fake();
 await reconcileVerifiedEvent({...base,status:'pix_pending',eventId:'e1'},db.adapter);
 assert.equal(db.orders.size,1);assert.equal(db.orders.get(base.orderId).status,'pending');
 assert.equal(db.outbox.size,0);
 await reconcileVerifiedEvent({...base,status:'paid',eventId:'e2'},db.adapter);
 assert.equal(db.orders.get(base.orderId).status,'approved');assert.equal(db.outbox.size,1);
 await reconcileVerifiedEvent({...base,status:'refunded',eventId:'e3'},db.adapter);
 assert.equal(db.orders.get(base.orderId).status,'refunded');assert.equal(db.orders.size,1);
 assert.equal(db.outbox.size,1);
});
test('mesma notificação repetida não duplica evento, pedido ou purchase',async()=>{
 const db=fake(),e={...base,status:'paid',eventId:'repeat-id'};
 await reconcileVerifiedEvent(e,db.adapter);
 const result=await reconcileVerifiedEvent(e,db.adapter);
 assert.equal(result.duplicate,true);assert.equal(db.orders.size,1);
 assert.equal(db.outbox.size,1);assert.equal(db.events.size,1);
});
test('um Pix antigo não reverte reembolso ou aprovação',async()=>{
 const db=fake();await reconcileVerifiedEvent({...base,status:'paid',eventId:'yes'},db.adapter);
 await reconcileVerifiedEvent({...base,status:'refunded',eventId:'refund'},db.adapter);
 await reconcileVerifiedEvent({...base,status:'pix_pending',eventId:'late'},db.adapter);
 assert.equal(db.orders.get(base.orderId).status,'refunded');
});
test('rejeita payload sem identificador real e alterações de titularidade',async()=>{
 assert.throws(()=>normalizeVerifiedEvent({...base,orderId:'',status:'paid'}));
 const db=fake();await reconcileVerifiedEvent({...base,status:'paid',eventId:'first'},db.adapter);
 await assert.rejects(reconcileVerifiedEvent({...base,customerEmail:'someone-else@ex.com',status:'refunded',eventId:'second'},db.adapter),/outro comprador/);
});
test('GA4 purchase contém transaction_id, BRL, item, valor uma vez',async()=>{
 const db=fake();await reconcileVerifiedEvent({...base,status:'paid',eventId:'ga'},db.adapter);
 const x=db.outbox.get(base.orderId);assert.equal(x.name,'purchase');
 assert.equal(x.params.transaction_id,'order-100');assert.equal(x.params.currency,'BRL');
 assert.equal(x.params.value,24.90);assert.equal(x.params.items[0].item_id,'book-001');
});
