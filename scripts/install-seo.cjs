'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function install(dir=root){const rel='scripts/stage-cloudflare.cjs',target=path.join(dir,rel),previous=fs.readFileSync(target,'utf8');const hook="    require('./seo-pages.cjs').generateSeo(output);";if(previous.includes(hook))return false;const anchor='    assertPublic(output);';if(previous.split(anchor).length!==2)throw Error('Estágio Cloudflare alterado; nenhuma mudança feita.');const next=previous.replace(anchor,anchor+'\n'+hook);const backup=path.join(dir,'private','seo-backup',rel);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,previous,{flag:'wx'});fs.writeFileSync(target,next);return true;}
module.exports={install};if(require.main===module){try{console.log(install()?'SEO instalado no estágio Cloudflare; backup em private/seo-backup/.':'SEO já instalado.');}catch(e){console.error(e.message);process.exitCode=1;}}
