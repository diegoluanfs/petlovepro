'use strict';
const {mergeOrder,normalizeEmail}=require('./commerce-core.cjs');
function makeFirebaseCommerceStore(db){
  return {
    async getProduct(id){const snap=await db.collection('commercialProducts').doc(id).get();return snap.exists?{...snap.data(),id}:null;},
    async getProductByKiwifyId(productId){
      const s=await db.collection('commercialProducts').where('kiwifyProductId','==',productId).limit(2).get();
      return s.size===1?{...s.docs[0].data(),id:s.docs[0].id}:null;
    },
    async createIntent(intent){await db.collection('checkoutIntents').doc(intent.id).create(intent);return intent.id;},
    async resolveVerifiedUID(email){
      const q=await db.collection('users').where('emailLower','==',normalizeEmail(email)).limit(2).get();
      if(q.size!==1)return null;
      const u=q.docs[0].data();return u.emailVerified===true?q.docs[0].id:null;
    },
    async resolveCheckoutAttribution(email,productId,trackingIntentId){
      if(trackingIntentId){
        const doc=await db.collection('checkoutIntents').doc(trackingIntentId).get();
        const i=doc.exists?doc.data():null;
        // Não associe compra de outro produto ou e-mail ao usuário autenticado.
        return i?.emailLower===normalizeEmail(email)&&i?.kiwifyProductId===productId?i:null;
      }
      // Sem s1, o e-mail verificado ainda pode vincular o pedido em Minha conta,
      // mas não atribuímos a conversão a uma sessão incerta.
      return null;
    },
    async atomicSave(event){
      const orderRef=db.collection('commerceOrders').doc(event.orderId);
      const eventRef=db.collection('commerceWebhookEvents').doc(event.eventId);
      const analyticsRef=db.collection('commerceAnalyticsOutbox').doc(event.orderId);
      const userRef=event.uid?db.collection('users').doc(event.uid).collection('orders').doc(event.orderId):null;
      return db.runTransaction(async trx=>{
        // Todas as leituras devem ocorrer antes das gravações (Firestore transaction).
        const [existingSnap,eventSnap,analyticsSnap]=await Promise.all([trx.get(orderRef),trx.get(eventRef),trx.get(analyticsRef)]);
        if(eventSnap.exists)return {duplicate:true,status:existingSnap.exists?existingSnap.data().status:null};
        const old=existingSnap.exists?existingSnap.data():null;
        const {updated,emitPurchase,changed}=mergeOrder(old,event);
        if(changed){
          trx.set(orderRef,updated,{merge:true});
          if(userRef)trx.set(userRef,updated,{merge:true});
        }
        trx.create(eventRef,{orderId:event.orderId,status:event.status,receivedAt:event.at});
        if(emitPurchase&&!analyticsSnap.exists)trx.create(analyticsRef,{orderId:event.orderId,
          transactionId:event.orderId,uid:updated.uid||null,status:'queued',attempts:0,
          amountCents:event.amountCents,catalogId:event.catalogId,productTitle:event.productTitle,currency:'BRL',ga4ClientId:updated.ga4ClientId||null,analyticsConsent:updated.analyticsConsent===true});
        return {duplicate:false,status:updated.status,orderId:event.orderId,uid:updated.uid||null};
      });
    }
  };
}
module.exports={makeFirebaseCommerceStore};

// Deve ser invocado por syncProfile após autenticação e verificação do e-mail.
// Não concede acesso ao conteúdo; o direito de acesso permanece na Kiwify.
async function linkOrdersForVerifiedUser(db, user){
  if(!user?.uid||!user.email||user.emailVerified!==true)return {linked:0};
  const email=normalizeEmail(user.email);
  const s=await db.collection('commerceOrders').where('emailLower','==',email).limit(100).get();
  let linked=0;
  for(const doc of s.docs){
    const order=doc.data();if(order.uid&&order.uid!==user.uid)continue;
    await db.runTransaction(async tx=>{
      const current=await tx.get(doc.ref);if(!current.exists)return;
      if(current.data().uid&&current.data().uid!==user.uid)return;
      tx.set(doc.ref,{uid:user.uid},{merge:true});
      tx.set(db.collection('users').doc(user.uid).collection('orders').doc(doc.id),{...current.data(),uid:user.uid},{merge:true});
    });linked++;
  }
  return {linked};
}
module.exports.linkOrdersForVerifiedUser=linkOrdersForVerifiedUser;
