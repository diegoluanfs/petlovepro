'use strict';
/** HTTP responses for an already signature-authenticated Kiwify payload. */
const PERMANENT=new Set(['invalid-event','invalid-store','currency-mismatch',
 'unmapped-product','order-conflict']);
function webhookFailureStatus(err){return PERMANENT.has(err?.code)?422:500;}
module.exports={webhookFailureStatus};
