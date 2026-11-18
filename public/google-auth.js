// Only basic identity scopes are requested; no access to Gmail, Drive or contacts.
export function chooseGoogleAccount(auth, instance){
  const provider=new auth.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  return auth.signInWithPopup(instance,provider);
}
export function googleError(code){return ({
  'auth/popup-closed-by-user':'A janela do Google foi fechada. Você pode tentar novamente.',
  'auth/cancelled-popup-request':'A solicitação anterior foi cancelada. Tente novamente.',
  'auth/popup-blocked':'Permita pop-ups para este site no navegador e tente novamente.',
  'auth/unauthorized-domain':'Este endereço ainda não está autorizado no Firebase.',
  'auth/operation-not-allowed':'O login com Google ainda não foi habilitado no Firebase.',
  'auth/account-exists-with-different-credential':'Já existe uma conta com outro método de acesso. Entre com o método original.',
  'auth/web-storage-unsupported':'Abra o site no Chrome, Safari ou outro navegador com armazenamento habilitado.'
})[code]||'';}
