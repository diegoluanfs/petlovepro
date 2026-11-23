// Read-only audit: does not write Firestore, call webhooks, or expose checkout URLs.
const fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const {validCheckout}=require('../functions/logic.cjs');
const {validate}=require('./kiwify-plan.cjs');
const ROOT=path.resolve(__dirname,'..'),PROJECT='petlovepro-ae222';
function audit(config,catalog,store,docs){
 validate(config,catalog);
 const issues=[],rows=[];
 const add=(id,msg)=>issues.push({id,problem:msg});
 if(config.enabled!==false)add('store','Configuração local não está desativada');
 if(store?.enabled!==false)add('store','Firestore: trava global ausente ou ativa');
 if(catalog.length!==60||new Set(catalog.map(x=>x.id)).size!==60)add('catalog','Catálogo não contém 60 IDs únicos');
 const idset=new Set(),urlset=new Set(),docMap=new Map(docs.map(d=>[d.id,d.data]));
 if(docs.length!==60||docMap.size!==60)add('firestore','Quantidade de documentos diferente de 60');
 const wanted=new Map(catalog.map(x=>[x.id,x]));
 for(const p of config.products){
   const start=issues.length,c=wanted.get(p.catalogId),d=docMap.get(p.kiwifyProductId),price=c.kind==='collection'?7990:2490;
   if(!p.kiwifyProductId||idset.has(p.kiwifyProductId))add(p.catalogId,'ID externo ausente ou duplicado');
   idset.add(p.kiwifyProductId);
   if(!validCheckout(p.checkout)||urlset.has(p.checkout))add(p.catalogId,'Checkout inválido ou duplicado');
   urlset.add(p.checkout);
   if(p.price!==price||p.enabled!==true||p.checkoutEnabled!==false)add(p.catalogId,'Preço ou travas locais divergentes');
   if(c.live!==false||c.price!==null)add(p.catalogId,'Catálogo público não está em modo pré-lançamento');
   if(!d)add(p.catalogId,'Documento Firestore ausente');
   else for(const field of ['catalogId','title','checkout','price','enabled','checkoutEnabled'])if(d[field]!==p[field])add(p.catalogId,`Firestore: divergência em ${field}`);
   rows.push({catalogId:p.catalogId,ok:issues.length===start});
 }
 for(const d of docs)if(!idset.has(d.id))add('firestore','Documento externo fora do plano');
 return {ok:issues.length===0,expected:60,checked:rows.length,valid:rows.filter(x=>x.ok).length,issues};
}
async function main(){
 if(process.env.FIRESTORE_EMULATOR_HOST)throw Error('Remova FIRESTORE_EMULATOR_HOST: este comando verifica produção.');
 const config=JSON.parse(fs.readFileSync(path.join(ROOT,'private','kiwify-products.local.json'),'utf8').replace(/^\uFEFF/,''));
 const {allProducts,settings}=await import('../public/catalog.js');
 validate(config,allProducts);
 const req=createRequire(path.join(ROOT,'functions','package.json'));
 const {initializeApp,applicationDefault,deleteApp}=req('firebase-admin/app');
 const {getFirestore}=req('firebase-admin/firestore');
 const app=initializeApp({credential:applicationDefault(),projectId:PROJECT});
 try{
   const db=getFirestore(app);
   const report=await db.runTransaction(async tx=>{
     const store=await tx.get(db.doc('commerce/kiwify'));
     const docs=await tx.get(db.collection('kiwifyProducts'));
     return audit(config,allProducts,store.data(),docs.docs.map(d=>({id:d.id,data:d.data()})));
   },{readOnly:true});
   console.log(JSON.stringify({project:PROJECT,...report},null,2));
   const missing=['support','merchantLegalName','merchantDocument','merchantAddress','memberUrl'].filter(k=>typeof settings?.[k]!=='string'||!settings[k].trim());
   if(missing.length)console.warn('Revisar campos públicos antes do lançamento: '+missing.join(', '));
   if(!report.ok)process.exitCode=1;
 }finally{await deleteApp(app)}
}
module.exports={audit};if(require.main===module)main().catch(e=>{console.error(e.code||'Erro',e.message);process.exitCode=1});
