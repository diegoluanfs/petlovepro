const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const v1=require('firebase-functions/v1');
const {normalizeEmail,hash,validEmail,verifySignature,parseOrder,nextStatus,profileAccess,catalogId,validMapping,buildKiwifyCheckout}=require('./logic.cjs');
initializeApp();const db=getFirestore(), stamp=()=>FieldValue.serverTimestamp(), region='us-central1';
const secret=defineSecret('KIWIFY_WEBHOOK_TOKEN');
const interests=new Set(['dog','cat','both']);
const providersFor=user=>[...new Set((user.providerData||[]).map(p=>p.providerId))].sort();
// Creates a minimal profile even if a new user closes the browser before the callable completes.
exports.registered=v1.region(region).auth.user().onCreate(async user=>{const email=normalizeEmail(user.email);if(!validEmail(email))return;const ref=db.collection('customers').doc(user.uid);await db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)tx.create(ref,{email,name:user.displayName||'',emailVerified:user.emailVerified===true,providers:providersFor(user),marketing:false,interest:'both',createdAt:stamp(),updatedAt:stamp()})})});
exports.syncProfile=onCall({region,maxInstances:10},async req=>{
 if(!req.auth)throw new HttpsError('unauthenticated','Login obrigatório.');const user=await getAuth().getUser(req.auth.uid);const email=normalizeEmail(user.email);if(!validEmail(email))throw new HttpsError('failed-precondition','E-mail indisponível.');if(user.disabled)throw new HttpsError('permission-denied','Conta desativada.');const verified=user.emailVerified===true;const d=req.data||{};if(typeof d!=='object'||Array.isArray(d))throw new HttpsError('invalid-argument','Dados inválidos.');const access=profileAccess(verified,d);if(!access.allowed)throw new HttpsError('permission-denied','Confirme seu e-mail para utilizar este recurso.');const ref=db.collection('customers').doc(user.uid);
 const current=await db.runTransaction(async tx=>{const snap=await tx.get(ref),old=snap.data()||{};const next={email,name:user.displayName||old.name||'',emailVerified:verified,providers:providersFor(user),interest:interests.has(old.interest)?old.interest:'both',marketing:old.marketing===true,updatedAt:stamp()};if(!snap.exists)next.createdAt=stamp();if(d.terms===true&&!old.termsAcceptedAt){next.termsAcceptedAt=stamp();next.termsVersion='preview-v1'}if(interests.has(d.interest))next.interest=d.interest;if(typeof d.marketing==='boolean'&&d.marketing!==next.marketing){next.marketing=d.marketing;next.marketingChangedAt=stamp();next.marketingConsentVersion='preview-v1'}tx.set(ref,next,{merge:true});return next});
 // No private profile preferences, orders or checkout URLs are returned to unverified accounts.
 if(!verified)return {emailVerified:false};
 if(access.requestsCheckout){
   if(!catalogId(d.checkoutId)||!Number.isSafeInteger(d.expectedPrice)||d.expectedPrice<=0)throw new HttpsError('invalid-argument','Produto ou valor inválido.');
   const [store,matches]=await Promise.all([db.collection('commerce').doc('kiwify').get(),db.collection('kiwifyProducts').where('catalogId','==',d.checkoutId).get()]);
   const checkout=buildKiwifyCheckout(store.data(),matches.docs.map(doc=>doc.data()),d.checkoutId,d.expectedPrice);
   if(!checkout)throw new HttpsError('failed-precondition','Checkout indisponível ou preço atualizado.');
   return {emailVerified:true,checkout};
 }
 // Never accept an email or a purchase state from the browser. Ownership comes from verified Firebase Auth.
 let orders=[];if(verified){const s=await db.collection('orders').where('emailKey','==',hash(email)).get();orders=s.docs.map(doc=>{const o=doc.data();return {id:doc.id,productId:o.catalogId,productName:o.productName,status:o.status,updatedAt:o.updatedAt?.toDate().toISOString().slice(0,10)||''}}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
 return {name:current.name,interest:current.interest,marketing:current.marketing,emailVerified:verified,providers:current.providers,orders};
});
// Public HTTPS receiver; authentication is the provider signature, not browser authentication.
exports.kiwifyWebhook=onRequest({region,secrets:[secret],maxInstances:10,timeoutSeconds:30},async(req,res)=>{
 if(req.method!=='POST')return res.status(405).send('Method not allowed');
 if(!req.is('application/json'))return res.status(415).send('Unsupported media type');
 if(!Buffer.isBuffer(req.rawBody)||req.rawBody.length>512000)return res.status(413).send('Payload too large');
 if(!verifySignature(req.rawBody,req.query.signature,secret.value()))return res.status(401).send('Invalid signature');
 let o;try{o=parseOrder(JSON.parse(req.rawBody.toString('utf8')))}catch{return res.status(400).send('Invalid payload')}
 if(!o)return res.status(200).send('Ignored event');
 const orderRef=db.collection('orders').doc(hash(o.id));
 const eventRef=db.collection('webhookEvents').doc(hash(o.id+':'+o.status));
 const mapRef=db.collection('kiwifyProducts').doc(o.productId);
 try{
   const result=await db.runTransaction(async tx=>{
     const [event,previous,map]=await Promise.all([tx.get(eventRef),tx.get(orderRef),tx.get(mapRef)]);
     const prev=previous.data()||{};
     if(previous.exists&&(prev.emailKey!==o.emailKey||prev.kiwifyProductId!==o.productId||prev.provider!=='kiwify'))return 'conflict';
     if(event.exists)return 'duplicate';
     const product=map.data();
     // Existing orders keep their original catalog assignment, even if the seller later removes a mapping.
     if(!previous.exists&&(!map.exists||!validMapping(product)))return 'unmapped';
     const status=nextStatus(prev.status,o.status);
     if(!previous.exists||status!==prev.status){
       const fields={provider:'kiwify',externalOrderId:o.id,kiwifyProductId:o.productId,catalogId:previous.exists?prev.catalogId:product.catalogId,productName:previous.exists?prev.productName:product.title,emailKey:o.emailKey,buyerEmail:o.email,status,updatedAt:stamp()};
       if(!previous.exists)fields.createdAt=stamp();
       if(o.status==='approved'&&o.amountMinor!==undefined){fields.amountMinor=o.amountMinor;fields.currency=o.currency;}
       tx.set(orderRef,fields,{merge:true});
     }
     tx.create(eventRef,{provider:'kiwify',orderKey:orderRef.id,event:o.event,status:o.status,receivedAt:stamp()});
     return 'ok';
   });
   if(result==='conflict')return res.status(409).send('Order identity conflict');
   if(result==='unmapped')return res.status(422).send('Unmapped product');
   return res.status(200).send(result==='duplicate'?'Already processed':'OK');
 }catch(e){console.error('Webhook transaction failed',e.code||'transaction');return res.status(500).send('Retry later')}
});
