#!/usr/bin/env node
'use strict';
/** Safe probes: never submit purchase events. A signed probe uses an ignored event. */
const {createHmac}=require('node:crypto');
const endpoint='https://us-central1-petlovepro-ae222.cloudfunctions.net/kiwifyCommerceWebhookV2';
const base=process.argv.find(x=>x.startsWith('--url='))?.slice(6)||endpoint;
const signed=process.argv.includes('--signed');
async function probe(url,fetchImpl=fetch,{signedToken=null}={}){
  const u=new URL(url);
  if(u.protocol!=='https:')throw Error('O endpoint precisa usar HTTPS.');
  const result=[];
  const tests=[
    {name:'GET deve rejeitar com 405',method:'GET',expect:405},
    {name:'POST sem assinatura deve rejeitar com 401',method:'POST',expect:401,
      body:JSON.stringify({webhook_event_type:'plp_probe',store_id:'invalid'})}
  ];
  if(signedToken!==null){
    if(typeof signedToken!=='string'||signedToken.length<32)throw Error('Token inválido para diagnóstico assinado.');
    const body=JSON.stringify({store_id:'zqlEDKV4S2QSt38',webhook_event_type:'plp_diagnostic'});
    const sig=createHmac('sha1',signedToken).update(Buffer.from(body,'utf8')).digest('hex');
    const signedUrl=new URL(u);signedUrl.searchParams.set('signature',sig);
    tests.push({name:'POST assinado com evento ignorado deve responder 200',method:'POST',expect:200,
      requestUrl:signedUrl,body});
  }
  for(const t of tests){
    const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),12000);
    try{
      const r=await fetchImpl(t.requestUrl||u,{method:t.method,body:t.body,signal:ctrl.signal,
        headers:{'Content-Type':'application/json'},redirect:'manual'});
      result.push({name:t.name,status:r.status,passed:r.status===t.expect});
    }finally{clearTimeout(tm)}
  }
  return {endpoint:u.origin+u.pathname,ok:result.every(x=>x.passed),results:result,
    note:'Nenhuma requisição contém pedido aprovado ou cria direitos de acesso.'};
}
if(require.main===module){probe(base,fetch,{signedToken:signed?process.env.KIWIFY_WEBHOOK_TOKEN||'':null})
 .then(x=>{console.log(JSON.stringify(x,null,2));if(!x.ok)process.exitCode=1})
 .catch(e=>{console.error('Falha no probe:',e.message);process.exitCode=1});}
module.exports={probe};
