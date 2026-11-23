'use strict';
async function auditSite(base,fetchImpl=fetch){
  const origin=new URL(base);
  if(origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))
    throw Error('A URL precisa ser HTTPS, exceto localhost.');
  const fetchText=async name=>{
    const u=new URL(name,origin);
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
    try{
      const res=await fetchImpl(u,{redirect:'follow',signal:ctrl.signal,headers:{'Cache-Control':'no-cache'}});
      if(!res.ok)throw Error(name+' retornou HTTP '+res.status);
      const txt=await res.text();if(txt.length>2_500_000)throw Error(name+' maior que o esperado');
      return txt;
    }finally{clearTimeout(timeout)}
  };
  const failures=[],checks=[];
  const check=(name,passed,description)=>{checks.push({name,passed,description});if(!passed)failures.push(name);};
  const parts={};
  for(const name of ['/', '/app.js','/commerce-client.js','/catalog-commerce.json','/seller-public.json','/firebase-config.js']){
    try{parts[name]=await fetchText(name);check(name,true,'HTTP 2xx')}catch(e){check(name,false,e.message)}
  }
  if(parts['/'])check('frontend-login',parts['/'].includes('app.js')&&parts['/'].includes('commerce-client.js'),'HTML deve carregar app.js e commerce-client.js');
  if(parts['/app.js'])check('callable-frontend',parts['/app.js'].includes('commerceBeginCheckout')&&parts['/app.js'].includes('commerceGetAccount')&&parts['/app.js'].includes('enableGA4'),'Frontend comercial e GA4 opt-in presentes');
  if(parts['/commerce-client.js'])check('checkout-protegido',parts['/commerce-client.js'].includes('beginCheckout')&&parts['/commerce-client.js'].includes('hasAnalyticsConsent'),'Checkout validado por Firebase');
  if(parts['/catalog-commerce.json']){
    try{
      const catalog=JSON.parse(parts['/catalog-commerce.json']);
      const items=catalog.items||[];
      check('60-produtos',items.length===60&&items.filter(p=>p.kind==='book').length===50&&items.filter(p=>p.kind==='collection').length===10,'Catálogo 50 livros + 10 coleções');
      check('60-ofertas-ativas',items.every(p=>p.live===true&&p.price===(p.kind==='book'?2490:7990)),'Preço comercial estático');
      check('sem-ofertas-privadas',items.every(p=>!p.checkout&&!p.kiwifyOfferId&&!p.kiwifyProductId),'Sem checkout/IDs privados no catálogo público');
    }catch(e){check('catalogo-json',false,'JSON inválido: '+e.message)}
  }
  if(parts['/seller-public.json']){
    try{
      const seller=JSON.parse(parts['/seller-public.json']);
      check('ga4-id',seller.analyticsMeasurementId==='G-K2CLX0L79J','ID público de medição GA4');
      check('atendimento',!!seller.supportEmail&&!!seller.legalName,'Dados comerciais preenchidos e aprovados');
    }catch(e){check('seller-json',false,'JSON inválido: '+e.message)}
  }
  if(parts['/firebase-config.js'])check('firebase-project',parts['/firebase-config.js'].includes('petlovepro-ae222')&&parts['/firebase-config.js'].includes('us-central1'),'Projeto e região das Callables');
  return {base:origin.origin,ok:failures.length===0,checks,failures,
    note:'Este preflight não comprova GA4 em tempo real, webhook Kiwify, pagamento nem permissões de aluno.'};
}
module.exports={auditSite};
