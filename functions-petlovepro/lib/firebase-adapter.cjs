'use strict';
const {mergeOrder,normalizeEmail,CommerceError}=require('./commerce-core.cjs');
const {deriveLibrary}=require('./library-core.cjs');
function makeFirebaseCommerceStore(db){
  return {
    async getProduct(id){const snap=await db.collection('commercialProducts').doc(id).get();return snap.exists?{...snap.data(),id}:null;},
    async getProductByKiwifyId(productId){
      const s=await db.collection('commercialProducts').where('kiwifyProductId','==',productId).limit(2).get();
      return s.size===1?{...s.docs[0].data(),id:s.docs[0].id}:null;
    },
    async createIntent(intent){await db.collection('checkoutIntents').doc(intent.id).create(intent);return intent.id;},
    async resolveVerifiedUID(email){
      // Nunca confiar em users/{uid}.emailVerified: documento de perfil pode ser legado.
      // A fonte de identidade é Firebase Authentication (servidor).
      try {
        const user=await require('firebase-admin/auth').getAuth().getUserByEmail(normalizeEmail(email));
        return !user.disabled&&user.emailVerified===true?user.uid:null;
      } catch(e){if(e.code==='auth/user-not-found')return null;throw e;}
    },
    async resolveCheckoutAttribution(email,productId,trackingIntentId){
      if(trackingIntentId){
        const doc=await db.collection('checkoutIntents').doc(trackingIntentId).get();
        const i=doc.exists?doc.data():null;
        // Não associe compra de outro produto ou e-mail ao usuário autenticado.
        return i?.emailLower===normalizeEmail(email)&&i?.kiwifyProductId===productId
          &&i?.uid&&i?.status==='started'?i:null;
      }
      // Sem s1, o e-mail verificado ainda pode vincular o pedido em Minha conta,
      // mas não atribuímos a conversão a uma sessão incerta.
      return null;
    },
    async atomicSave(event){
      // Firestore document ids from a signed third-party payload must never contain paths.
      if(!/^[a-zA-Z0-9_-]{1,128}$/.test(String(event.orderId||'')) ||
         !/^[a-zA-Z0-9_:-]{2,200}$/.test(String(event.eventId||'')))
        throw new CommerceError('invalid-event','Identificador do pedido inválido.');
      const orderRef=db.collection('commerceOrders').doc(event.orderId);
      const eventRef=db.collection('commerceWebhookEvents').doc(event.eventId);
      const analyticsRef=db.collection('commerceAnalyticsOutbox').doc(event.orderId);
      return db.runTransaction(async trx=>{
        // Todas as leituras devem ocorrer antes das gravações (Firestore transaction).
        const [existingSnap,eventSnap,analyticsSnap]=await Promise.all([trx.get(orderRef),trx.get(eventRef),trx.get(analyticsRef)]);
        const old=existingSnap.exists?existingSnap.data():null;
        // A duplicate webhook must return the original UID so that a previous
        // post-commit library refresh failure can be repaired on delivery retry.
        if(old?.uid&&event.uid&&old.uid!==event.uid)
          throw new CommerceError('order-conflict','Pedido já associado a outra conta.');
        if(eventSnap.exists){
          // A second delivery can also associate an older unclaimed order to
          // the now-verified account, without changing its financial status.
          if(old&&!old.uid&&event.uid){
            trx.set(orderRef,{uid:event.uid},{merge:true});
            trx.set(db.collection('users').doc(event.uid).collection('orders').doc(event.orderId),
              {...old,uid:event.uid},{merge:true});
          }
          return {duplicate:true,status:old?.status||null,
            orderId:event.orderId,uid:old?.uid||event.uid||null};
        }
        const {updated,emitPurchase,changed}=mergeOrder(old,event);
        if(changed){
          trx.set(orderRef,updated,{merge:true});
          if(updated.uid)trx.set(db.collection('users').doc(updated.uid).collection('orders').doc(event.orderId),updated,{merge:true});
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

/**
 * Reconstitui o espelho integralmente a partir dos pedidos atualmente aprovados.
 * A transação evita perder direitos quando dois webhooks chegam juntos.
 */
async function refreshLibraryForUser(db,uid){
  if(!uid) return null;
  const doc=db.collection('commerceLibraries').doc(uid);
  return db.runTransaction(async tx=>{
    const q=db.collection('commerceOrders').where('uid','==',uid).limit(500);
    const ordersSnap=await tx.get(q);
    const orders=ordersSnap.docs.map(x=>x.data());
    const ids=new Set(orders.filter(x=>x.status==='approved').map(x=>x.catalogId));
    // Buscamos também todos os livros para validar as cinco posições da coleção.
    const productRefs=[...ids].map(id=>db.collection('commercialProducts').doc(id));
    if([...ids].some(id=>String(id).startsWith('collection-'))){
      for(let i=1;i<=50;i++)productRefs.push(db.collection('commercialProducts').doc(`book-${String(i).padStart(3,'0')}`));
    }
    const uniqueRefs=[...new Map(productRefs.map(ref=>[ref.path,ref])).values()];
    const snaps=uniqueRefs.length?await tx.getAll(...uniqueRefs):[];
    const products=snaps.filter(s=>s.exists).map(s=>({...s.data(),id:s.id}));
    const library=deriveLibrary(orders,products);
    const result={...library,uid,calculatedAt:Date.now()};
    tx.set(doc,result);
    return result;
  });
}
module.exports.refreshLibraryForUser=refreshLibraryForUser;
