'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
function validWebhookSignature(rawBody,signature,token){
  if(!Buffer.isBuffer(rawBody)||typeof token!=='string'||token.length<32)return false;
  if(!/^[0-9a-f]{40}$/i.test(String(signature||'')))return false;
  const expected=createHmac('sha1',token).update(rawBody).digest();
  return timingSafeEqual(expected,Buffer.from(signature,'hex'));
}
module.exports={validWebhookSignature};
