'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
const {makeFirebaseCommerceStore,linkOrdersForVerifiedUser}=require('./lib/firebase-adapter.cjs');
const {resolveCheckout,reconcileVerifiedEvent,CommerceError,formatOrder}=require('./lib/commerce-core.cjs');
const region='us-central1';
const requireAppCheck=process.env.PLP_ENFORCE_APPCHECK==='true';
function currentUser(request){const auth=request.auth;if(!auth?.uid)return null;
  return {uid:auth.uid,email:auth.token?.email,emailVerified:auth.token?.email_verified===true};}
const commerceBeginCheckout=onCall({region,enforceAppCheck:requireAppCheck},async req=>{
  const store=makeFirebaseCommerceStore(getFirestore());
  try{return await resolveCheckout({user:currentUser(req),productId:req.data?.productId,store,
    createIntent:i=>store.createIntent(i),ga4ClientId:req.data?.ga4ClientId,
    analyticsConsent:req.data?.analyticsConsent===true});}
  catch(err){if(err instanceof CommerceError)throw new HttpsError('failed-precondition',err.message,{code:err.code});
    console.error('commerceBeginCheckout unexpected failure',err?.code||err?.name);
    throw new HttpsError('internal','Não foi possível validar a oferta neste momento. Nenhuma cobrança foi iniciada.');}
});
const commerceGetAccount=onCall({region,enforceAppCheck:requireAppCheck},async req=>{
  const user=currentUser(req);
  if(!user?.uid)throw new HttpsError('unauthenticated','Entre na sua conta para consultar pedidos.');
  if(!user.email||!user.emailVerified)throw new HttpsError('failed-precondition','Confirme seu e-mail para consultar as compras.');
  const db=getFirestore();
  await linkOrdersForVerifiedUser(db,user);
  const snap=await db.collection('commerceOrders').where('emailLower','==',user.email.trim().toLowerCase()).limit(100).get();
  const orders=snap.docs.map(d=>d.data()).filter(o=>o.uid===user.uid)
    .sort((a,b)=>String(b.lastReceivedAt||'').localeCompare(String(a.lastReceivedAt||'')))
    .map(o=>formatOrder(o,'https://dashboard.kiwify.com.br/courses',null));
  return {orders,memberUrl:'https://dashboard.kiwify.com.br/courses'};
});
async function reconcileVerifiedKiwifyEvent(event){
  return reconcileVerifiedEvent(event,makeFirebaseCommerceStore(getFirestore()));
}
module.exports={commerceBeginCheckout,commerceGetAccount,reconcileVerifiedKiwifyEvent};
