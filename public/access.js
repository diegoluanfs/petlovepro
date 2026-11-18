// Public browsing never requires a session. Private actions use a verified identity.
export function accessState(user){return !user?'guest':user.emailVerified===true?'verified':'unverified'}
// Only an explicit, returning sign-in triggers the unsolicited reminder.
export function shouldRemind(user,{newAccount=false,explicitLogin=false}={}){return explicitLogin&&!newAccount&&accessState(user)==='unverified'}
export const trackingKeys=['src','sck','utm_source','utm_medium','utm_campaign','utm_content','utm_term','s1','s2','s3'];
export function validCheckout(value){if(typeof value!=='string'||value.length>2048)return false;try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pay.kiwify.com.br'&&!u.username&&!u.password&&!u.port&&!u.hash&&/^\/[a-zA-Z0-9_-]{1,128}\/?$/.test(u.pathname)&&[...u.searchParams].every(([k,v])=>[...trackingKeys,'afid'].includes(k)&&v.length<=150)}catch{return false}}
export function checkoutWithTracking(value,search){if(!validCheckout(value))return null;const u=new URL(value),params=new URLSearchParams(search);for(const k of trackingKeys){const v=params.get(k);if(v&&!u.searchParams.has(k))u.searchParams.set(k,v.slice(0,150));}return u.href;}
