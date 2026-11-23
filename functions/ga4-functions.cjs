'use strict';
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore}=require('firebase-admin/firestore');
const {sendGA4Purchase}=require('./lib/ga4-core.cjs');
const GA4_API_SECRET=defineSecret('GA4_API_SECRET');
const commerceGA4Purchase=onDocumentCreated({document:'commerceAnalyticsOutbox/{orderId}',region:'us-central1',
  secrets:[GA4_API_SECRET],retry:true},async ev=>{
    const ref=ev.data?.ref,data=ev.data?.data();if(!ref||!data)return;
    const db=getFirestore();
    const acquired=await db.runTransaction(async tx=>{
      const snap=await tx.get(ref),d=snap.data();if(!d||!['queued','retry'].includes(d.status))return false;
      tx.update(ref,{status:'sending',lastAttemptAt:Date.now(),attempts:(d.attempts||0)+1});return true;
    });
    if(!acquired)return;
    if(data.analyticsConsent!==true||!data.ga4ClientId){await ref.set({status:'skipped',reason:'consent-not-available'},{merge:true});return;}
    const order={orderId:data.orderId,catalogId:data.catalogId,productTitle:data.productTitle,amountCents:data.amountCents};
    try{const response=await sendGA4Purchase({order,clientId:data.ga4ClientId,consentGranted:true,
      measurementId:'G-K2CLX0L79J',apiSecret:GA4_API_SECRET.value()});
      if(response.sent)await ref.set({status:'sent',sentAt:Date.now(),transactionId:data.orderId},{merge:true});
    }catch(err){await ref.set({status:'retry',error:'ga4-send-failed'},{merge:true});throw err;}
  });
module.exports={commerceGA4Purchase};
