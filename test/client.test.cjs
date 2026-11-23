const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/commerce-client.js'),'utf8');
const catalog={items:[{id:'book-001',title:'Receitas Naturais Saudáveis para Pets',price:2490,live:true},{id:'book-002',title:'Livro 002',price:null,live:false}]};
function ui(){const store=new Map(),location={calls:[],assign(x){this.calls.push(x)}};const w={PetLoveProCommerceCatalog:catalog,location,alert:()=>{},setTimeout:fn=>fn(),dataLayer:[]};const sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 vm.runInNewContext(source,{window:w,sessionStorage,Date,JSON,Intl,URL,Promise,console});return {w,store,location};}
test('compra iniciada deslogado preserva livro para continuar após login',async()=>{
 const {w,store}=ui();let called=false;w.PetLoveProCommerce.configure({getUser:()=>null,openLogin:()=>{called=true;}});
 const redirected=await w.PetLoveProCommerce.buy('001');assert.equal(redirected,false);
 assert.equal(called,true);assert.equal(w.PetLoveProCommerce.pending().productId,'book-001');
});
test('não permite checkout para livro ainda não liberado',async()=>{
 const {w}=ui();let message='';w.PetLoveProCommerce.configure({onError:x=>message=x});
 assert.equal(await w.PetLoveProCommerce.buy('002'),false);assert.match(message,/não foi liberado/);
});
test('compra autenticada recebe checkout validado pelo backend',async()=>{
 const {w,location}=ui();
 w.PetLoveProCommerce.configure({getUser:()=>({uid:'u1',emailVerified:true}),beginCheckout:async()=>({productId:'book-001',currency:'BRL',priceCents:2490,checkoutUrl:'https://pay.kiwify.com.br/gqYNAHL'})});
 assert.equal(await w.PetLoveProCommerce.buy('001'),true);
 assert.deepEqual(location.calls,['https://pay.kiwify.com.br/gqYNAHL']);
 assert.equal(w.PetLoveProCommerce.pending(),null);
});
test('navegador bloqueia redirecionamento com preço adulterado',async()=>{
 const {w,location}=ui();let error='';
 w.PetLoveProCommerce.configure({getUser:()=>({uid:'u1',emailVerified:true}),beginCheckout:async()=>({productId:'book-001',currency:'BRL',priceCents:2990,checkoutUrl:'https://pay.kiwify.com.br/gqYNAHL'}),onError:x=>error=x});
 assert.equal(await w.PetLoveProCommerce.buy('001'),false);
 assert.equal(location.calls.length,0);assert.match(error,/Preço ou destino/);
});
