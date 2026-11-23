'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {validCheckout,EXPECTED}=require('./catalog-core.cjs');
class CommerceError extends Error {
  constructor(code,message){super(message);this.name='CommerceError';this.code=code;}
}
const PUBLIC_MESSAGES={
  'auth-required':'Entre na sua conta para continuar sua compra.',
  'email-unverified':'Confirme seu e-mail antes de continuar a compra.',
  'not-found':'Não encontramos a oferta selecionada.',
  'not-released':'Este material ainda não foi liberado para compra.',
  'offer-unavailable':'A oferta está temporariamente indisponível. Nenhuma cobrança foi realizada.',
  'price-mismatch':'Detectamos uma divergência no preço da oferta. Sua compra não foi iniciada.',
  'invalid-offer':'Não foi possível validar o endereço da oferta. Tente novamente mais tarde.',
  'unexpected':'Não foi possível concluir. Tente novamente ou contate o atendimento.'
};
function fail(code){throw new CommerceError(code,PUBLIC_MESSAGES[code]||PUBLIC_MESSAGES.unexpected);}
function mapId(id){
  if(/^\d{1,3}$/.test(String(id)))return `book-${String(id).padStart(3,'0')}`;
  if(/^(book|collection)-(\d{2,3})$/.test(String(id)))return String(id);
  fail('not-found');
}
function normalizeEmail(v){return String(v||'').trim().toLowerCase();}
function moneyBRL(cents){return (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
async function resolveCheckout({user,productId,store,createIntent=async x=>x.id,ga4ClientId=null,analyticsConsent=false,now=()=>Date.now()}) {
  if(!user?.uid)fail('auth-required');
  if(!user.email||!user.emailVerified)fail('email-unverified');
  const id=mapId(productId);
  const p=await store.getProduct(id);
  if(!p)fail('not-found');
  if(p.live!==true)fail('not-released');
  if(p.offerActive!==true||p.offerVerified!==true)fail('offer-unavailable');
  const expected=EXPECTED[p.kind];
  if(!expected||p.price!==expected||p.offerPriceCents!==expected||p.currency!=='BRL')fail('price-mismatch');
  if(!validCheckout(p.checkout))fail('invalid-offer');
  if(!p.kiwifyProductId||!p.kiwifyOfferId)fail('invalid-offer');
  const intent={id:randomUUID(),uid:user.uid,emailLower:normalizeEmail(user.email),productId:id,
    kiwifyProductId:p.kiwifyProductId,kiwifyOfferId:p.kiwifyOfferId,priceCents:expected,
    currency:'BRL',status:'started',ga4ClientId:/^\d+\.\d+$/.test(String(ga4ClientId||''))?ga4ClientId:null,
    analyticsConsent:analyticsConsent===true,createdAt:now(),expiresAt:now()+2*3600*1000};
  await createIntent(intent);
  // A Kiwify preserva s1 em TrackingParameters.s1, permitindo conciliação exata.
  const checkout=new URL(p.checkout);
  checkout.searchParams.set('s1',intent.id);
  checkout.searchParams.set('email',user.email.trim());
  return {intentId:intent.id,productId:id,productName:p.title,priceCents:expected,currency:'BRL',checkoutUrl:checkout.toString()};
}
const STATUS={
  paid:'approved',approved:'approved',complete:'approved',completed:'approved',payment_approved:'approved',
  pix_pending:'pending',waiting_payment:'pending',pending:'pending',awaiting_payment:'pending',waiting:'pending',
  refunded:'refunded',refund:'refunded',refunded_payment:'refunded',
  chargeback:'chargeback',dispute:'chargeback',
  cancelled:'cancelled',canceled:'cancelled',failed:'cancelled'
};
const RANK={pending:1,cancelled:1,approved:2,refunded:3,chargeback:4};
function normalizeVerifiedEvent(event){
  // Este adaptador recebe SOMENTE dados previamente autenticados pelo webhook existente.
  // Não infira arbitrariamente ids/e-mails de um payload desconhecido.
  const orderId=String(event.orderId||'').trim();
  const productId=String(event.kiwifyProductId||'').trim();
  const status=STATUS[String(event.status||'').toLowerCase()];
  const email=normalizeEmail(event.customerEmail);
  const amount=Number(event.amountCents);
  if(!orderId||!productId||!email||!status||!Number.isInteger(amount)||amount<0)
    throw new CommerceError('invalid-event','Evento Kiwify incompleto: enviar para revisão sem conciliar.');
  const key=event.eventId||createHash('sha256').update([orderId,status,productId,amount,email].join('|')).digest('hex');
  return {orderId,productId,status,email,amountCents:amount,eventId:String(key),currency:event.currency||'BRL',
    checkoutIntentId:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(event.checkoutIntentId||''))?String(event.checkoutIntentId):null,
    at:String(event.occurredAt||new Date().toISOString())};
}
async function reconcileVerifiedEvent(raw,{getProductByKiwifyId,resolveVerifiedUID,atomicSave,resolveCheckoutAttribution}) {
  const event=normalizeVerifiedEvent(raw);
  const product=await getProductByKiwifyId(event.productId);
  if(!product)throw new CommerceError('unmapped-product','Produto do webhook não existe no mapa comercial.');
  if(product.currency!=='BRL'||event.currency!=='BRL')throw new CommerceError('currency-mismatch','Moeda do webhook divergente.');
  // Eventual desconto aplicado no checkout exige auditoria, não altera o catálogo público.
  const uid=await resolveVerifiedUID(event.email);
  const attribution=typeof resolveCheckoutAttribution==='function'?await resolveCheckoutAttribution(event.email,event.productId,event.checkoutIntentId):null;
  return atomicSave({...event,catalogId:product.id,productTitle:product.title,uid:uid||null,
    ga4ClientId:attribution?.uid===uid?attribution.ga4ClientId:null,analyticsConsent:attribution?.uid===uid&&attribution?.analyticsConsent===true});
}
function mergeOrder(existing,event) {
  if(existing&&existing.kiwifyProductId!==event.productId)throw new CommerceError('order-conflict','Pedido recebido com outro produto.');
  if(existing&&existing.emailLower!==event.email)throw new CommerceError('order-conflict','Pedido recebido com outro comprador.');
  const old=existing?.status;
  const keepOld=old&&RANK[old]>RANK[event.status];
  const status=keepOld?old:event.status;
  const updated={...(existing||{}),orderId:event.orderId,catalogId:event.catalogId,
    productTitle:event.productTitle,kiwifyProductId:event.productId,emailLower:event.email,
    uid:existing?.uid||event.uid||null,status,amountCents:event.amountCents,currency:'BRL',
    firstReceivedAt:existing?.firstReceivedAt||event.at,lastReceivedAt:event.at,
    ga4ClientId:existing?.ga4ClientId||event.ga4ClientId||null,analyticsConsent:existing?.analyticsConsent===true||event.analyticsConsent===true};
  return {updated,emitPurchase:status==='approved'&&old!=='approved'&&!existing?.purchaseEverEmitted,
    changed:!existing||status!==old||(!existing.uid&&event.uid)};
}
function analyticsPurchase(order){return {name:'purchase',params:{transaction_id:order.orderId,currency:'BRL',value:order.amountCents/100,
    items:[{item_id:order.catalogId,item_name:order.productTitle,price:order.amountCents/100,quantity:1}]}};}
function formatOrder(o,memberUrl,contact){
  const status=({pending:'Aguardando pagamento',approved:'Compra aprovada',refunded:'Reembolsada',chargeback:'Pagamento contestado',cancelled:'Cancelado'})[o.status]||'Em análise';
  const collection=String(o.catalogId).startsWith('collection-');
  const approved=o.status==='approved';
  return {orderId:o.orderId,productId:o.catalogId,productName:o.productTitle,status,
    purchaseStatus:o.status,accessLabel:approved?(collection?'Acessar meus 5 e-books':'Acessar meu e-book'):null,
    memberUrl:approved?memberUrl:null,helpEmail:contact||null,
    instructions:approved?'Use na Kiwify o e-mail utilizado na compra. Entre na Biblioteca → escolha o curso → Seu e-book → aula → Anexos para baixar o PDF.':
      o.status==='pending'?'Seu Pix ainda aguarda confirmação. O acesso será liberado após a aprovação.':null};
}
module.exports={CommerceError,PUBLIC_MESSAGES,fail,mapId,normalizeEmail,moneyBRL,resolveCheckout,
  normalizeVerifiedEvent,reconcileVerifiedEvent,mergeOrder,analyticsPurchase,formatOrder};
