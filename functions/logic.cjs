const crypto=require('node:crypto');
const normalizeEmail=e=>typeof e==='string'?e.trim().toLowerCase():'';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function validEmail(e){return typeof e==='string'&&e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}
const externalId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(v);
const catalogId=v=>typeof v==='string'&&/^(?:00[1-9]|0[1-4][0-9]|050|nutricao-natural|colecao-0[2-9]|colecao-10)$/.test(v);
function verifySignature(raw,signature,secret){if(!Buffer.isBuffer(raw)||typeof secret!=='string'||!secret||typeof signature!=='string'||!/^[a-f0-9]{40}$/i.test(signature))return false;const expected=crypto.createHmac('sha1',secret).update(raw).digest();return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'))}
const statuses={order_approved:'approved',order_refunded:'refunded',chargeback:'chargeback',order_chargeback:'chargeback'};
function parseOrder(body){
 const event=body?.webhook_event_type;if(typeof event!=='string'||!Object.hasOwn(statuses,event))return null;
 const id=body.order_id,productId=body.Product?.product_id,email=normalizeEmail(body.Customer?.email);
 if(!externalId(id)||!externalId(productId)||!validEmail(email))throw Error('invalid payload');
 if(event==='order_approved'&&body.order_status!=='paid')throw Error('invalid paid status');
 const order={id,productId,email,emailKey:hash(email),status:statuses[event],event};
 // Optional financial data is copied only from a signed event; do not guess a price from the catalog.
 const c=body.Commissions;
 if(c&&typeof c.currency==='string'&&/^[A-Z]{3}$/.test(c.currency)){
   const amount=typeof c.charge_amount==='string'&&/^\d{1,12}$/.test(c.charge_amount)?Number(c.charge_amount):c.charge_amount;
   if(Number.isSafeInteger(amount)&&amount>=0){order.amountMinor=amount;order.currency=c.currency;}
 }
 return order;
}
function nextStatus(current,incoming){const rank={approved:1,refunded:2,chargeback:3};if(!Object.hasOwn(rank,incoming)||(current&&!Object.hasOwn(rank,current)))throw Error('invalid status');return !current||rank[incoming]>rank[current]?incoming:current}
function profileAccess(verified,data={}){
 const changesPreferences=Object.hasOwn(data,'interest')||Object.hasOwn(data,'marketing');
 const requestsCheckout=Object.hasOwn(data,'checkoutId');
 return {allowed:verified===true||(!changesPreferences&&!requestsCheckout),requestsCheckout};
}
const trackingKeys=['src','sck','utm_source','utm_medium','utm_campaign','utm_content','utm_term','s1','s2','s3'];
function validCheckout(value){if(typeof value!=='string'||value.length>2048)return false;try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pay.kiwify.com.br'&&!u.username&&!u.password&&!u.port&&!u.hash&&/^\/[a-zA-Z0-9_-]{1,128}\/?$/.test(u.pathname)&&[...u.searchParams].every(([k,v])=>[...trackingKeys,'afid'].includes(k)&&v.length<=150)}catch{return false}}
function validMapping(p){return p&&catalogId(p.catalogId)&&typeof p.title==='string'&&p.title.trim().length>0&&p.title.length<=240;}
function buildKiwifyCheckout(config,products,id,expectedPrice){
 if(config?.enabled!==true||!catalogId(id)||!Number.isSafeInteger(expectedPrice)||expectedPrice<=0)return null;
 const matches=products.filter(p=>validMapping(p)&&p.catalogId===id&&p.enabled===true&&p.checkoutEnabled===true&&validCheckout(p.checkout));
 if(matches.length!==1||matches[0].price!==expectedPrice)return null;
 return matches[0].checkout;
}
module.exports={profileAccess,validCheckout,normalizeEmail,hash,validEmail,verifySignature,parseOrder,nextStatus,catalogId,validMapping,buildKiwifyCheckout};
