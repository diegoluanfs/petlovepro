/* PetLovePro — integração sem dependência de framework. Carregar após o catálogo. */
(function(global){'use strict';
  const STORAGE='petlovepro:checkout-intent:v1';const MAX_AGE=2*3600*1000;
  const catalog=()=>global.PetLoveProCommerceCatalog?.items||[];
  const normalizedId=id=>/^\d{1,3}$/.test(String(id))?'book-'+String(id).padStart(3,'0'):String(id);
  const item=id=>catalog().find(p=>p.id===normalizedId(id));
  const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
  let deps={getUser:()=>null,beginCheckout:null,openLogin:()=>{},openVerify:()=>{},onError:msg=>global.alert(msg)};
  function configure(value){deps={...deps,...value};}
  function remember(productId){try{sessionStorage.setItem(STORAGE,JSON.stringify({productId:normalizedId(productId),createdAt:Date.now()}));}catch{}}
  function pending(){try{const v=JSON.parse(sessionStorage.getItem(STORAGE)||'null');if(!v||Date.now()-v.createdAt>MAX_AGE)return null;return item(v.productId)?v:null;}catch{return null;}}
  function clear(){try{sessionStorage.removeItem(STORAGE);}catch{}}
  function eventGA4(name,p){
    if(!p||deps.hasAnalyticsConsent?.()!==true)return;const data={event:name,ecommerce:{currency:'BRL',value:p.price/100,
      items:[{item_id:p.id,item_name:p.title,price:p.price/100,quantity:1}]}};
    if(typeof global.gtag==='function')global.gtag('event',name,{currency:'BRL',value:p.price/100,items:data.ecommerce.items});
    else if(Array.isArray(global.dataLayer))global.dataLayer.push(data);
  }
  function viewItem(id){const p=item(id);if(p&&p.live&&p.price)eventGA4('view_item',p);}
  function clientIdGA4(){return new Promise(resolve=>{
    if(deps.hasAnalyticsConsent?.()!==true||typeof global.gtag!=='function'){resolve(null);return;}
    let done=false;const complete=x=>{if(!done){done=true;resolve(x||null);}};
    global.setTimeout(()=>complete(null),450);
    try{global.gtag('get','G-K2CLX0L79J','client_id',complete);}catch{complete(null);}
  });}
  async function buy(id){
    const p=item(id);
    if(!p||!p.live){deps.onError('Este item ainda não foi liberado para compra.');return false;}
    remember(p.id);
    const user=deps.getUser();
    if(!user){deps.openLogin();return false;}
    if(!user.emailVerified){deps.openVerify();return false;}
    if(typeof deps.beginCheckout!=='function'){deps.onError('O serviço de compras está temporariamente indisponível.');return false;}
    try{
      const ga4ClientId=await clientIdGA4();
      const result=await deps.beginCheckout({productId:p.id,ga4ClientId,analyticsConsent:deps.hasAnalyticsConsent?.()===true});
      if(!result||result.productId!==p.id||result.currency!=='BRL'||result.priceCents!==p.price||
         !/^https:\/\/pay\.kiwify\.com\.br\/[A-Za-z0-9]+(?:\?.*)?$/.test(result.checkoutUrl||''))
        throw new Error('Preço ou destino do checkout diverge do catálogo. Nenhuma cobrança foi iniciada.');
      eventGA4('begin_checkout',p);
      clear();global.location.assign(result.checkoutUrl);return true;
    }catch(err){deps.onError(err?.message||'Não foi possível validar a oferta. Nenhuma cobrança foi iniciada.');return false;}
  }
  function renderContinue(target){
    const container=typeof target==='string'?document.querySelector(target):target;
    if(!container)return;
    container.replaceChildren();const q=pending(),user=deps.getUser();
    if(!q||!user?.emailVerified)return;
    const p=item(q.productId);if(!p?.live)return;
    const b=document.createElement('button');b.type='button';b.className='button primary';
    b.textContent=`Continuar compra — ${p.title} (${money(p.price)})`;
    b.addEventListener('click',()=>buy(p.id));container.append(b);
  }
  function createOrderNode(order,{memberUrl,supportEmail}={}){
    const e=document.createElement('article');e.className='petlovepro-order';
    const title=document.createElement('strong');title.textContent=order.productName||order.productTitle||'Produto digital';e.append(title);
    const line=document.createElement('p');const label={pending:'Aguardando pagamento',approved:'Compra aprovada',refunded:'Reembolsado',chargeback:'Pagamento contestado',cancelled:'Cancelado'};
    line.textContent=`Pedido ${order.orderId||'—'} · ${label[order.status]||'Em análise'}`;e.append(line);
    if(order.status==='approved'&&memberUrl){const access=document.createElement('a');access.href=memberUrl;access.target='_blank';access.rel='noopener noreferrer';access.className='button primary';
      access.textContent=String(order.catalogId||order.productId||'').startsWith('collection-')?'Acessar meus 5 e-books':'Acessar meu e-book';e.append(access);
      const info=document.createElement('p');info.textContent='Use na Kiwify o e-mail informado na compra. Biblioteca → Curso → Seu e-book → Aula → Anexos → PDF.';e.append(info);}
    if(supportEmail){const a=document.createElement('a');a.href=`mailto:${encodeURIComponent(supportEmail)}?subject=${encodeURIComponent('PetLovePro — ajuda com pedido '+(order.orderId||''))}`;
      a.textContent='Preciso de ajuda com meu acesso';e.append(a);}
    return e;
  }
  function renderOrders(target,orders,opts){const el=typeof target==='string'?document.querySelector(target):target;if(!el)return;
    el.replaceChildren();for(const order of orders||[])el.append(createOrderNode(order,opts));}
  global.PetLoveProCommerce={configure,buy,viewItem,renderContinue,renderOrders,remember,pending,clear,item};
})(window);
