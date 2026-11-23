'use strict';
const admin=require('firebase-admin');
const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
if(!admin.apps.length)admin.initializeApp();
const {validWebhookSignature}=require('./lib/webhook-signature.cjs');
const {fromVerifiedKiwifyPayload}=require('./lib/kiwify-normalizer.cjs');
const {CommerceError}=require('./lib/commerce-core.cjs');
const {commerceBeginCheckout,commerceGetAccount,reconcileVerifiedKiwifyEvent}=require('./commerce-functions.cjs');
const {commerceGA4Purchase}=require('./ga4-functions.cjs');
const KIWIFY_WEBHOOK_TOKEN=defineSecret('KIWIFY_WEBHOOK_TOKEN');
exports.commerceBeginCheckout=commerceBeginCheckout;
exports.commerceGetAccount=commerceGetAccount;
exports.commerceGA4Purchase=commerceGA4Purchase;
// Nome novo: não substitui silenciosamente o webhook original de um projeto em produção.
exports.kiwifyCommerceWebhookV2=onRequest({region:'us-central1',secrets:[KIWIFY_WEBHOOK_TOKEN],
  timeoutSeconds:40, memory:'256MiB',cors:false,maxInstances:15},async(req,res)=>{
  if(req.method!=='POST'){res.set('Allow','POST').status(405).send('Método inválido');return;}
  const raw=req.rawBody;
  if(!raw||raw.length>128*1024){res.status(413).send('Tamanho inválido');return;}
  const valid=validWebhookSignature(raw,req.query.signature,KIWIFY_WEBHOOK_TOKEN.value());
  if(!valid){res.status(401).send('Assinatura inválida');return;}
  try{
    const body=JSON.parse(raw.toString('utf8'));
    let normalized;
    try{normalized=fromVerifiedKiwifyPayload(body)}catch(e){
      if(e.code==='ignored-event'){res.status(200).json({ignored:true});return;}
      throw e;
    }
    const result=await reconcileVerifiedKiwifyEvent(normalized);
    res.status(200).json({ok:true,duplicate:result.duplicate===true});
  }catch(e){
    console.error('Erro ao conciliar webhook',e?.code||e?.name);
    // 5xx permite retentativa pela Kiwify para eventos legítimos mal processados.
    res.status(500).json({ok:false,message:'Falha transitória de conciliação'});
  }
});
