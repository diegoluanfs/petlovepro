const crypto=require('node:crypto');
const normalizeEmail=e=>typeof e==='string'?e.trim().toLowerCase():'';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function validEmail(e){return e.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}
function verifySignature(raw,signature,secret){if(!Buffer.isBuffer(raw)||!secret||typeof signature!=='string'||!/^[a-f0-9]{40}$/i.test(signature))return false;const expected=crypto.createHmac('sha1',secret).update(raw).digest();return crypto.timingSafeEqual(expected,Buffer.from(signature,'hex'))}
const statuses={order_approved:'approved',order_refunded:'refunded',chargeback:'chargeback',order_chargeback:'chargeback'};
function parseOrder(body){const event=body?.webhook_event_type;if(typeof event!=='string'||!Object.hasOwn(statuses,event))return null;const id=body.order_id,productId=body.Product?.product_id,email=normalizeEmail(body.Customer?.email);if(typeof id!=='string'||id.length<1||id.length>160||typeof productId!=='string'||!productId||productId.length>160||productId.includes('/')||!validEmail(email))throw Error('invalid payload');if(event==='order_approved'&&body.order_status!=='paid')throw Error('invalid paid status');return {id,productId,email,emailKey:hash(email),status:statuses[event],event};}
function nextStatus(current,incoming){const rank={approved:1,refunded:2,chargeback:3};if(!Object.hasOwn(rank,incoming))throw Error('invalid status');return !current||rank[incoming]>rank[current]?incoming:current}
// Validation shared by the callable and its tests. The client cannot assert its own status.
function profileAccess(verified,data={}){
 const changesPreferences=Object.hasOwn(data,'interest')||Object.hasOwn(data,'marketing');
 const requestsCheckout=Object.hasOwn(data,'checkoutId');
 return {allowed:verified===true||(!changesPreferences&&!requestsCheckout),requestsCheckout};
}
function validCheckout(value){if(typeof value!=='string')return false;try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pay.kiwify.com.br'&&!u.username&&!u.password&&!u.port}catch{return false}}
module.exports={profileAccess,validCheckout,normalizeEmail,hash,validEmail,verifySignature,parseOrder,nextStatus};
