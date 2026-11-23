'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {deriveLibrary}=require('../functions-petlovepro/lib/library-core.cjs');
const {reconcileVerifiedEvent,CommerceError,mergeOrder}=require('../functions-petlovepro/lib/commerce-core.cjs');
const book=n=>`book-${String(n).padStart(3,'0')}`;
const collection={id:'collection-02',kind:'collection',volumeIds:[41,42,43,44,45].map(book)};
const products=[...Array.from({length:50},(_,i)=>({id:book(i+1),kind:'book'})),collection];
const order=(id,status,orderId=id)=>({catalogId:id,status,orderId});
test('Firebase: apenas pedidos aprovados geram livros na biblioteca',()=>{
 const lib=deriveLibrary([order('book-001','pending'),order('book-002','approved'),order('book-003','refunded')],products);
 assert.deepEqual(lib.bookIds,['book-002']);assert.equal(lib.bookCount,1);assert.equal(lib.deliveryProvider,'kiwify');
});
test('Firebase: coleção concede exatamente os cinco livros esperados, sem vazamento',()=>{
 const lib=deriveLibrary([order('collection-02','approved')],products);
 assert.deepEqual(lib.bookIds,collection.volumeIds);assert.deepEqual(lib.collectionIds,['collection-02']);assert.equal(lib.bookCount,5);
});
test('Firebase: sobreposição entre livro individual e coleção não duplica acesso',()=>{
 const lib=deriveLibrary([order('collection-02','approved','a'),order('book-041','approved','b')],products);
 assert.equal(lib.bookCount,5);assert.deepEqual(lib.sourceOrderIds,['a','b']);
});
test('Firebase: reembolso de coleção preserva outro livro ainda pago',()=>{
 const lib=deriveLibrary([order('collection-02','refunded','a'),order('book-041','approved','b')],products);
 assert.deepEqual(lib.bookIds,['book-041']);assert.deepEqual(lib.collectionIds,[]);
});
test('Firebase: composição incompleta ou adulterada da coleção falha fechada',()=>{
 const invalid=[{id:'collection-02',kind:'collection',volumeIds:['book-041','book-042','book-043','book-044','book-044']},...products.filter(p=>p.kind==='book')];
 assert.equal(deriveLibrary([order('collection-02','approved')],invalid).bookCount,0);
 const foreign=[{id:'collection-02',kind:'collection',volumeIds:['book-041','book-042','book-043','book-044','book-999']},...products.filter(p=>p.kind==='book')];
 assert.equal(deriveLibrary([order('collection-02','approved')],foreign).bookCount,0);
});
test('Firebase: produto inexistente, pedido pendente e status arbitrário não concedem direitos',()=>{
 const lib=deriveLibrary([order('book-000','approved'),order('book-050','chargeback'),order('random','approved'),order('book-041','custom')],products);
 assert.deepEqual(lib.bookIds,[]);
});
test('Firebase: payload de compra não pode atribuir uid de um s1 diferente do Auth verificado',async()=>{
 const spy=[];
 const db={
  getProductByKiwifyId:async()=>({id:'book-001',title:'Livro 001',currency:'BRL'}),
  resolveVerifiedUID:async()=> 'firebase-uid-real',
  resolveCheckoutAttribution:async()=>({uid:'outro-uid',ga4ClientId:'123.456',analyticsConsent:true}),
  atomicSave:async event=>{spy.push(event);return {uid:event.uid};}
 };
 await reconcileVerifiedEvent({orderId:'o1',kiwifyProductId:'kiwify-id',customerEmail:'TEST@example.com',amountCents:2490,status:'paid'},db);
 assert.equal(spy[0].uid,'firebase-uid-real');assert.equal(spy[0].ga4ClientId,null);assert.equal(spy[0].analyticsConsent,false);
});
test('Firebase: reembolso posterior é terminal, inclusive diante de webhook atrasado',()=>{
 const common={orderId:'ord1',catalogId:'book-001',productTitle:'Livro',productId:'product',email:'p@x.com',uid:'uid',amountCents:2490,at:'now'};
 const approved=mergeOrder(null,{...common,status:'approved'}).updated;
 const refunded=mergeOrder(approved,{...common,status:'refunded'}).updated;
 const delayed=mergeOrder(refunded,{...common,status:'approved'}).updated;
 assert.equal(delayed.status,'refunded');
});
const {refreshLibraryForUser}=require('../functions-petlovepro/lib/firebase-adapter.cjs');
function fakeDb(orderData,productData){
 const saved=[];
 const db={
  collection(name){return {
   where(field,op,value){return {type:'query',collection:name,field,op,value,limit(n){return this}};},
   doc(id){return {type:'doc',collection:name,id,path:name+'/'+id};}
  }},
  async runTransaction(action){const tx={
   async get(ref){
    if(ref.type==='query')return {docs:orderData.filter(o=>o.uid===ref.value).map(o=>({data:()=>o}))};
    const data=productData.find(p=>p.id===ref.id);return {exists:!!data,id:ref.id,data:()=>data};
   },
   async getAll(...refs){return Promise.all(refs.map(ref=>this.get(ref)));},
   set(ref,value){saved.push({path:ref.path,value});}
  };return action(tx);},saved
 };
 return db;
}
test('Firebase: o espelho é reconstruído com dados aprovados e grava apenas comércio do UID autenticado',async()=>{
 const db=fakeDb([{...order('collection-02','approved','c1'),uid:'uid-1'},{...order('book-001','pending','p1'),uid:'uid-1'},
  {...order('book-050','approved','other'),uid:'uid-2'}],products);
 const result=await refreshLibraryForUser(db,'uid-1');
 assert.equal(result.bookCount,5);assert.deepEqual(result.bookIds,collection.volumeIds);
 assert.equal(db.saved.length,1);assert.equal(db.saved[0].path,'commerceLibraries/uid-1');
 assert.ok(!db.saved[0].value.bookIds.includes('book-050'));
});
test('Firebase: o reembolso retira direito quando não existe outro pedido válido',async()=>{
 const db=fakeDb([{...order('collection-02','refunded','r1'),uid:'uid-3'}],products);
 const lib=await refreshLibraryForUser(db,'uid-3');
 assert.deepEqual(lib.bookIds,[]);assert.equal(db.saved.length,1);
});
