'use strict';
/**
 * Espelho de direitos de leitura. O PDF permanece sob controle da Kiwify.
 * A origem é exclusivamente commerceOrders, com status verificado no webhook.
 * Não recebe flags de acesso do navegador nem de documentos de perfil editáveis.
 */
const BOOK=/^book-(?:00[1-9]|0[1-4][0-9]|050)$/;
const COLLECTION=/^collection-(?:0[1-9]|10)$/;
function deriveLibrary(orders, products) {
  const map=products instanceof Map?products:new Map(products.map(p=>[p.id,p]));
  const sourceOrders=new Map();
  const books=new Set(),collections=new Set();
  for(const order of orders){
    if(order?.status!=='approved')continue;
    const id=String(order.catalogId||'');
    const product=map.get(id);
    if(!product)continue; // Sem mapa confiável não se concede direito.
    if(BOOK.test(id)&&product.kind==='book'){
      books.add(id);
      sourceOrders.set(order.orderId,id);
    } else if(COLLECTION.test(id)&&product.kind==='collection'){
      const ids=product.volumeIds;
      if(!Array.isArray(ids)||ids.length!==5||new Set(ids).size!==5||!ids.every(v=>BOOK.test(v)&&map.get(v)?.kind==='book'))continue;
      collections.add(id);
      for(const book of ids)books.add(book);
      sourceOrders.set(order.orderId,id);
    }
  }
  return {
    bookIds:[...books].sort(),collectionIds:[...collections].sort(),
    sourceOrderIds:[...sourceOrders.keys()].sort(),
    bookCount:books.size,collectionCount:collections.size,
    memberUrl:'https://dashboard.kiwify.com.br/courses',
    deliveryProvider:'kiwify',
    note:'Este é um espelho dos pedidos aprovados. O acesso aos PDFs continua administrado pela área de membros da Kiwify.'
  };
}
module.exports={deriveLibrary};
