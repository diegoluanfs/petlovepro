'use strict';
const {CommerceError}=require('./commerce-core.cjs');
const EVENT_MAP={order_approved:'paid',pix_created:'pix_pending',billet_created:'waiting_payment',order_refunded:'refunded',order_rejected:'cancelled',order_cancelled:'cancelled',order_chargeback:'chargeback',chargeback:'chargeback',order_expired:'cancelled'};
const STORE_ID='zqlEDKV4S2QSt38';
function fromVerifiedKiwifyPayload(body){
  if(!body||typeof body!=='object')throw new CommerceError('invalid-event','Payload inválido');
  if(body.store_id!==STORE_ID)throw new CommerceError('invalid-store','Webhook recebido de outra loja.');
  const type=String(body.webhook_event_type||'');
  const status=EVENT_MAP[type];
  if(!status)throw new CommerceError('ignored-event','Evento não é compra suportada: '+type);
  const amount=Number(body.Commissions?.charge_amount);
  const currency=body.Commissions?.currency||body.Commissions?.product_base_price_currency||'BRL';
  return {orderId:body.order_id,kiwifyProductId:body.Product?.product_id,customerEmail:body.Customer?.email,
    amountCents:amount,currency,status,checkoutIntentId:body.TrackingParameters?.s1||null,
    eventId:[body.order_id,type].join(':'),occurredAt:body.updated_at||body.created_at};
}
module.exports={fromVerifiedKiwifyPayload,EVENT_MAP,STORE_ID};
