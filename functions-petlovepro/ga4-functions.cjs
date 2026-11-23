'use strict';
const {onDocumentCreated}=require('firebase-functions/v2/firestore');
const {defineSecret}=require('firebase-functions/params');
const {getFirestore}=require('firebase-admin/firestore');
const {sendGA4Purchase}=require('./lib/ga4-core.cjs');
const {processAnalyticsOutbox}=require('./lib/ga4-outbox.cjs');
const GA4_API_SECRET=defineSecret('GA4_API_SECRET');
// The Firestore database is in Sao Paulo. Keep the trigger colocated.
const commerceGA4Purchase=onDocumentCreated({document:'commerceAnalyticsOutbox/{orderId}',
  region:'southamerica-east1',secrets:[GA4_API_SECRET],retry:true},async ev=>{
    if(!ev.data?.ref)return;
    const outcome=await processAnalyticsOutbox({db:getFirestore(),ref:ev.data.ref,
      measurementId:'G-K2CLX0L79J',secret:GA4_API_SECRET.value(),send:sendGA4Purchase});
    console.info('GA4 purchase outbox', {orderId:ev.params.orderId,status:outcome.status});
  });
module.exports={commerceGA4Purchase};
