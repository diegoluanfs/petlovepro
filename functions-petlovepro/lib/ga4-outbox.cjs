'use strict';
/**
 * Firestore outbox processing for Eventarc at-least-once deliveries.
 * No browser token, payment entitlement or Kiwify access is created here.
 * This remains at-least-once on the external HTTP boundary: transaction_id
 * is stable so the GA4 receiver can deduplicate repeated purchases.
 */
const {randomUUID}=require('node:crypto');
const LEASE_MS=120000;
const MAX_ATTEMPTS=8;
const TERMINAL=new Set(['sent','skipped','failed']);

function decisionFor(row,at,leaseMs=LEASE_MS,maxAttempts=MAX_ATTEMPTS){
  if(!row||TERMINAL.has(row.status))return 'terminal';
  if(!['queued','retry','sending'].includes(row.status))return 'invalid';
  if(row.status==='sending'&&at-Number(row.lastAttemptAt||0)<leaseMs)return 'busy';
  if(Number(row.attempts||0)>=maxAttempts)return 'exhausted';
  return 'claim';
}

async function processAnalyticsOutbox({db,ref,send,secret,measurementId,now=()=>Date.now(),
  randomId=randomUUID,leaseMs=LEASE_MS,maxAttempts=MAX_ATTEMPTS}){
  if(!ref)return {status:'ignored'};
  const token=randomId();
  const acquired=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),row=snap.exists?snap.data():null;
    const action=decisionFor(row,now(),leaseMs,maxAttempts);
    if(action==='claim'){
      tx.update(ref,{status:'sending',leaseToken:token,lastAttemptAt:now(),
        attempts:Number(row.attempts||0)+1,error:null});
    }else if(action==='exhausted'){
      tx.update(ref,{status:'failed',error:'max-attempts',failedAt:now()});
    }
    return {action,row};
  });
  if(acquired.action==='terminal'||acquired.action==='exhausted')return {status:acquired.action};
  if(acquired.action==='invalid')throw new Error('GA4 outbox status invalid; inspect Firestore');
  if(acquired.action==='busy')throw new Error('GA4 delivery lease still active; retry later');
  const row=acquired.row;
  const finish=async fields=>db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists||snap.data().leaseToken!==token)return false;
    tx.update(ref,{...fields,leaseToken:null});return true;
  });
  if(row.analyticsConsent!==true||!/^\d+\.\d+$/.test(String(row.ga4ClientId||''))){
    await finish({status:'skipped',reason:'no-consent-or-client-id',completedAt:now()});
    return {status:'skipped'};
  }
  if(!/^[A-Za-z0-9_.:-]{1,128}$/.test(String(row.orderId||''))||
     !/^(book-\d{3}|collection-\d{2})$/.test(String(row.catalogId||''))||
     !Number.isSafeInteger(row.amountCents)||row.amountCents<0){
    await finish({status:'failed',error:'invalid-outbox-payload',failedAt:now()});
    return {status:'failed'};
  }
  try{
    const result=await send({order:{orderId:row.orderId,catalogId:row.catalogId,
      productTitle:row.productTitle,amountCents:row.amountCents},
      clientId:row.ga4ClientId,consentGranted:true,measurementId,apiSecret:secret});
    if(result?.sent!==true)throw new Error('ga4-not-confirmed');
    await finish({status:'sent',sentAt:now(),transactionId:row.orderId});
    return {status:'sent'};
  }catch(err){
    await finish({status:'retry',error:'ga4-send-failed',lastFailureAt:now()});
    // Throw to ask Eventarc to retry. On the next invocation, a stale lease
    // is reclaimed. A recent lease causes another retry instead of silently
    // finishing the Eventarc event and permanently stranding the document.
    throw err;
  }
}
module.exports={decisionFor,processAnalyticsOutbox,LEASE_MS,MAX_ATTEMPTS};
