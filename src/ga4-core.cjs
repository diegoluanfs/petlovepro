'use strict';
const {analyticsPurchase}=require('./commerce-core.cjs');
function purchasePayload(order,{clientId,consentGranted}){
  if(!consentGranted||!clientId)return null;
  const purchase=analyticsPurchase(order);
  return {client_id:clientId,events:[purchase],non_personalized_ads:true};
}
async function sendGA4Purchase({order,clientId,consentGranted,measurementId,apiSecret,fetchImpl=fetch}){
  const payload=purchasePayload(order,{clientId,consentGranted});
  if(!payload)return {skipped:true,reason:'Consentimento ou client_id indisponível'};
  if(!/^G-[A-Z0-9]+$/.test(measurementId||'')||!apiSecret)throw Error('GA4 não configurado');
  const u=new URL('https://www.google-analytics.com/mp/collect');
  u.searchParams.set('measurement_id',measurementId);u.searchParams.set('api_secret',apiSecret);
  const response=await fetchImpl(u.toString(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)throw Error(`GA4 respondeu ${response.status}`);
  return {sent:true,transactionId:order.orderId};
}
module.exports={purchasePayload,sendGA4Purchase};
