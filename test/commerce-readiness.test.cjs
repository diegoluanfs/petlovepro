const test=require('node:test'),assert=require('node:assert/strict');
const {audit}=require('../scripts/commerce-readiness.cjs');
const plan=require('../scripts/kiwify-plan.cjs');
const {buildKiwifyCheckout}=require('../functions/logic.cjs');
async function fixture(){const {allProducts}=await import('../public/catalog.js');const catalog=allProducts.map(x=>({...x,live:false,price:null}));const config=plan.template(catalog);for(const p of config.products){p.kiwifyProductId='provider-'+p.catalogId;p.checkout='https://pay.kiwify.com.br/test-'+p.catalogId;p.price=p.suggestedPrice;p.enabled=true;}const docs=plan.firestorePlan(config,catalog).products.map(d=>({id:d.path.split('/')[1],data:d.data}));return {catalog,config,docs,store:{enabled:false}};}
const run=x=>audit(x.config,x.catalog,x.store,x.docs);
test('all 60 real catalog IDs pass read-only prelaunch audit with simulated Firestore',async()=>{const x=await fixture();assert.deepEqual(run(x),{ok:true,expected:60,checked:60,valid:60,issues:[]})});
test('reject missing and foreign Firestore documents',async()=>{const x=await fixture();x.docs.pop();x.docs.push({id:'unexpected',data:{}});assert.equal(run(x).ok,false)});
test('reject active store or active checkout',async()=>{const x=await fixture();x.store.enabled=true;x.docs[0].data.checkoutEnabled=true;assert.equal(run(x).ok,false)});
test('reject mismatched price, title, checkout and public live flag',async()=>{const x=await fixture();x.docs[0].data.price=1;x.docs[1].data.title='wrong';x.docs[2].data.checkout='https://example.com/';x.catalog[3].live=true;assert.equal(run(x).valid,56)});
test('reject duplicate checkout and unexpected commercial price',async()=>{const x=await fixture();x.config.products[1].checkout=x.config.products[0].checkout;x.config.products[1].price=1;assert.equal(run(x).ok,false)});
test('all 60 checkout gates refuse disabled sales; after hypothetical enablement only expected price works',async()=>{const x=await fixture();for(const d of x.docs){const p=d.data;assert.equal(buildKiwifyCheckout(x.store,[p],p.catalogId,p.price),null);const active={...p,checkoutEnabled:true};assert.equal(buildKiwifyCheckout({enabled:true},[active],p.catalogId,p.price-1),null);assert.equal(buildKiwifyCheckout({enabled:true},[active],p.catalogId,p.price),p.checkout);assert.equal(buildKiwifyCheckout({enabled:true},[active,active],p.catalogId,p.price),null)}});
