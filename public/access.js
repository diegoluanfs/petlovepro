// Public browsing never requires a session. Private actions use a verified identity.
export function accessState(user){return !user?'guest':user.emailVerified===true?'verified':'unverified'}
// Only an explicit, returning sign-in triggers the unsolicited reminder.
export function shouldRemind(user,{newAccount=false,explicitLogin=false}={}){return explicitLogin&&!newAccount&&accessState(user)==='unverified'}
export function validCheckout(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='pay.kiwify.com.br'&&!u.username&&!u.password&&!u.port}catch{return false}}
