// PetLovePro: basic consent mode. Keep advertising off until the CMP is configured.
export const CONTAINER_ID = 'GTM-NNP2S2QS';
export const ADS_CLIENT = 'ca-pub-9294489692358309';
export const ADS_ENABLED = false;
export const CONSENT_KEY = 'petlovepro.cookies.v2';
const HOSTS = new Set(['petlovepro.com.br', 'www.petlovepro.com.br']);
const denied=()=>({analytics:false,ads:false});
const signals=c=>({analytics_storage:c.analytics?'granted':'denied',ad_storage:c.ads?'granted':'denied',ad_user_data:'denied',ad_personalization:'denied'});
export function createAnalytics(win,doc,{adsEnabled=ADS_ENABLED}={}){
  const active=win.location.protocol==='https:'&&HOSTS.has(win.location.hostname);
  let choice=null,gtmLoaded=false,adsLoaded=false;
  const normalized=c=>({analytics:c?.analytics===true,ads:adsEnabled&&c?.ads===true});
  function read(){try{const raw=win.localStorage.getItem(CONSENT_KEY);if(!raw)return null;const c=JSON.parse(raw);return typeof c?.analytics==='boolean'&&typeof c?.ads==='boolean'&&c.adsAvailable===adsEnabled?normalized(c):null;}catch{return null;}}
  function command(){win.dataLayer.push(arguments);}
  function load(id,src,crossOrigin){if(doc.getElementById(id))return;const s=doc.createElement('script');s.id=id;s.async=true;s.src=src;if(crossOrigin)s.crossOrigin=crossOrigin;doc.head.appendChild(s);}
  function apply(){if(!active)return;const c=choice||denied();command('consent','update',signals(c));if(c.analytics&&!gtmLoaded){gtmLoaded=true;win.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});load('petlovepro-gtm','https://www.googletagmanager.com/gtm.js?id='+CONTAINER_ID);}
    if(c.ads&&!adsLoaded){adsLoaded=true;win.adsbygoogle=win.adsbygoogle||[];win.adsbygoogle.requestNonPersonalizedAds=1;load('petlovepro-ads','https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+ADS_CLIENT,'anonymous');}}
  function clearCookies(c){try{for(const entry of doc.cookie.split(';')){const name=entry.split('=')[0].trim();const analytics=/^_ga(?:_[A-Za-z0-9_-]+)?$|^_gid$|^_gat(?:_[A-Za-z0-9_-]+)?$/.test(name);const ads=/^_gcl_|^__gads$|^__gpi$|^__eoi$/.test(name);if(!(analytics&&!c.analytics||ads&&!c.ads))continue;for(const domain of ['', '; Domain=petlovepro.com.br','; Domain='+win.location.hostname])doc.cookie=name+'=; Max-Age=0; Path=/; SameSite=Lax; Secure'+domain;}}catch{}}
  function change(next,persist){const prev=choice||denied();choice=next;const c=choice||denied();if(persist){try{win.localStorage.setItem(CONSENT_KEY,JSON.stringify({...c,adsAvailable:adsEnabled}));}catch{}}
    if(!active)return;const revoked=(gtmLoaded&&prev.analytics&&!c.analytics)||(adsLoaded&&prev.ads&&!c.ads);
    if(revoked){command('consent','update',signals(c));if(adsLoaded&&!c.ads&&win.adsbygoogle)win.adsbygoogle.pauseAdRequests=1;clearCookies(c);win.location.reload();return;}
    clearCookies(c);apply();}
  if(active){win.dataLayer=win.dataLayer||[];win.gtag=command;command('consent','default',signals(denied()));}
  choice=read();if(active){clearCookies(choice||denied());apply();}
  return {get choice(){return choice;},active,adsEnabled,setChoice(c){change(normalized(c),true);},syncStorage(){const saved=read();if(JSON.stringify(saved)!==JSON.stringify(choice))change(saved,false);}};
}
export function mountAnalytics(win,doc){
  const panel=doc.getElementById('analytics-consent'),manage=doc.getElementById('analytics-preferences');if(!panel||!manage)return;
  const ctl=createAnalytics(win,doc),stats=doc.getElementById('analytics-statistics'),ads=doc.getElementById('analytics-advertising'),status=doc.getElementById('analytics-status');
  doc.getElementById('analytics-ads-option').hidden=!ctl.adsEnabled;
  const refresh=()=>{stats.checked=ctl.choice?.analytics===true;ads.checked=ctl.choice?.ads===true;status.textContent=ctl.active?'Você pode mudar sua escolha a qualquer momento.':'Medição e anúncios não carregam neste ambiente.';};
  function finish(c){ctl.setChoice(c);refresh();panel.hidden=true;if(panel.contains(doc.activeElement))manage.focus({preventScroll:true});}
  panel.hidden=ctl.choice!==null;refresh();manage.addEventListener('click',()=>{refresh();panel.hidden=false;stats.focus();});
  doc.getElementById('analytics-reject').addEventListener('click',()=>finish(denied()));
  doc.getElementById('analytics-accept').addEventListener('click',()=>finish({analytics:true,ads:ctl.adsEnabled}));
  doc.getElementById('analytics-save').addEventListener('click',()=>finish({analytics:stats.checked,ads:ads.checked}));
  win.addEventListener('storage',e=>{if(e.key===CONSENT_KEY||e.key===null){ctl.syncStorage();refresh();panel.hidden=ctl.choice!==null;}});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')mountAnalytics(window,document);
