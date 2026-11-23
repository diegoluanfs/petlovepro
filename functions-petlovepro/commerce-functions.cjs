'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {getFirestore}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {makeFirebaseCommerceStore,linkOrdersForVerifiedUser,refreshLibraryForUser}=require('./lib/firebase-adapter.cjs');
const {resolveCheckout,reconcileVerifiedEvent,CommerceError,formatOrder}=require('./lib/commerce-core.cjs');
const region='us-central1';
const requireAppCheck=process.env.PLP_ENFORCE_APPCHECK==='true';
async function currentUser(request){
  if(!request.auth?.uid)return null;
  // Confirma no Auth do servidor: tokens antigos ou flags editáveis em Firestore não bastam.
  const account=await getAuth().getUser(request.auth.uid);
  if(account.disabled)return null;
  return {uid:account.uid,email:account.email,emailVerified:account.emailVerified===true};
}
const commerceBeginCheckout=onCall({region,enforceAppCheck:requireAppCheck},async req=>{
  const store=makeFirebaseCommerceStore(getFirestore());
  try{return await resolveCheckout({user:await currentUser(req),productId:req.data?.productId,store,
    createIntent:i=>store.createIntent(i),ga4ClientId:req.data?.ga4ClientId,
    analyticsConsent:req.data?.analyticsConsent===true});}
  catch(err){if(err instanceof CommerceError)throw new HttpsError('failed-precondition',err.message,{code:err.code});
    console.error('commerceBeginCheckout unexpected failure',err?.code||err?.name);
    throw new HttpsError('internal','Não foi possível validar a oferta neste momento. Nenhuma cobrança foi iniciada.');}
});
const commerceGetAccount=onCall({region,enforceAppCheck:requireAppCheck},async req=>{
  const user=await currentUser(req);
  if(!user?.uid)throw new HttpsError('unauthenticated','Entre na sua conta para consultar pedidos.');
  if(!user.email||!user.emailVerified)throw new HttpsError('failed-precondition','Confirme seu e-mail para consultar as compras.');
  const db=getFirestore();
  await linkOrdersForVerifiedUser(db,user);
  const library=await refreshLibraryForUser(db,user.uid);
  const snap=await db.collection('commerceOrders').where('emailLower','==',user.email.trim().toLowerCase()).limit(100).get();
  const orders=snap.docs.map(d=>d.data()).filter(o=>o.uid===user.uid)
    .sort((a,b)=>String(b.lastReceivedAt||'').localeCompare(String(a.lastReceivedAt||'')))
    .map(o=>formatOrder(o,'https://dashboard.kiwify.com.br/courses',null));
  return {orders,library,memberUrl:'https://dashboard.kiwify.com.br/courses'};
});
async function reconcileVerifiedKiwifyEvent(event){
  const db=getFirestore();
  const result=await reconcileVerifiedEvent(event,makeFirebaseCommerceStore(db));
  // Reprocessar também um webhook repetido recupera eventual falha parcial no espelho.
  if(result.uid)await refreshLibraryForUser(db,result.uid);
  return result;
}
module.exports={commerceBeginCheckout,commerceGetAccount,reconcileVerifiedKiwifyEvent};
