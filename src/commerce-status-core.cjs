'use strict';
const COLLECTIONS=['commercialProducts','checkoutIntents','commerceWebhookEvents',
 'commerceOrders','commerceLibraries','commerceAnalyticsOutbox'];
function aggregateCommerceStatus(entries,{sampleLimit=100,now=Date.now()}={}){
 const result={project:'petlovepro-ae222',sampleLimit,collections:{},alerts:[],
  note:'Amostras limitadas; não inclui e-mails, tokens, IDs de usuários nem links privados.'};
 for(const name of COLLECTIONS){
  const src=entries[name]||[];const rows=src.slice(0,sampleLimit);const counts={};
  for(const r of rows){const key=String(r.status||'unspecified').toLowerCase();counts[key]=(counts[key]||0)+1;}
  result.collections[name]={sampled:rows.length,truncated:src.length>sampleLimit,statuses:counts};
 }
 const products=(entries.commercialProducts||[]).slice(0,sampleLimit);
 result.products={sampled:products.length,books:products.filter(p=>p.kind==='book').length,
  collections:products.filter(p=>p.kind==='collection').length,active:products.filter(p=>p.live===true&&p.offerActive===true).length};
 if(result.products.sampled!==60||result.products.active!==60)result.alerts.push('Catalogo remoto precisa de auditoria: esperados 60 registros ativos.');
 const outbox=(entries.commerceAnalyticsOutbox||[]).slice(0,sampleLimit);
 const stuck=outbox.filter(x=>x.status==='sending'&&now-Number(x.lastAttemptAt||0)>120000).length;
 if(stuck)result.alerts.push(`${stuck} eventos GA4 em sending ha mais de 2 minutos. Consultar logs.`);
 const failed=outbox.filter(x=>x.status==='failed').length;
 if(failed)result.alerts.push(`${failed} eventos GA4 em failed; revisar manualmente.`);
 if(COLLECTIONS.some(n=>(entries[n]||[]).length>sampleLimit))result.alerts.push('Um ou mais resultados estao truncados; nao trate estas quantidades como totais globais.');
 return result;
}
module.exports={aggregateCommerceStatus,COLLECTIONS};
