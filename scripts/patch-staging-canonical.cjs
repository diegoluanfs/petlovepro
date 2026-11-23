#!/usr/bin/env node
'use strict';
/**
 * Patches CI and the local release checker to use the SAME validated staging
 * generator. Fails closed if the workflow uses an unfamiliar invocation.
 * Does not edit public/, Firestore, commerce data or the legacy stage builder.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const flow=path.join(root,'.github/workflows/cloudflare-pages.yml');
const pkg=path.join(root,'package.json');
const checker=path.join(root,'scripts/check-release-verified.cjs');
const original='scripts/stage-cloudflare.cjs';
const replacement='scripts/stage-cloudflare-canonical.cjs';
const apply=process.argv.includes('--apply');
function fail(message){throw Error('[PetLovePro v1.4.3] '+message);}
function count(src,text){return src.split(text).length-1;}
function plan(file,before,after){
  const source=fs.readFileSync(file,'utf8');
  if(source.includes(after) && !source.includes(before))return null;
  if(count(source,before)!==1)fail('Chamada inesperada em '+path.relative(root,file)+'; esperado 1 de '+JSON.stringify(before)+', encontrado '+count(source,before));
  if(source.includes(after))fail('Arquivo misturou chamadas antigas e novas: '+file);
  return {file,contents:source.replace(before,after)};
}
function main(){
 for(const file of [flow,pkg,checker,path.join(root,'scripts/stage-cloudflare-canonical.cjs')]){
   if(!fs.existsSync(file))fail('Arquivo ausente: '+path.relative(root,file));
 }
 const planned=[];
 const checkerPlan=plan(checker,"'"+original+"'","'"+replacement+"'");
 if(checkerPlan)planned.push(checkerPlan);
 const workflowText=fs.readFileSync(flow,'utf8');
 if(workflowText.includes(original)){
   const changed=plan(flow,original,replacement);
   if(changed)planned.push(changed);
 }else if(!workflowText.includes(replacement)){
   // Support a workflow whose staging step invokes a named npm script.
   const pkgObject=JSON.parse(fs.readFileSync(pkg,'utf8'));
   const scripts=Object.entries(pkgObject.scripts||{}).filter(([,cmd])=>cmd.includes(original));
   if(scripts.length!==1)fail('Workflow nao usa diretamente '+original+' e nao existe um script npm unico para ajustar. Veja a etapa "Prepare isolated static deployment".');
   const [name]=scripts[0];
   if(!workflowText.includes('npm run '+name))fail('Workflow nao chama o npm run '+name+'. Precisa de revisao manual.');
   const changed=plan(pkg,original,replacement);
   if(changed)planned.push(changed);
 }
 if(!planned.length){console.log('CI e validador ja utilizam staging canonico.');return;}
 for(const change of planned){
   const b=change.file+'.antes-v143.bak';
   if(fs.existsSync(b))fail('Backup ja existe, nao sobrescrever: '+path.relative(root,b));
 }
 console.log('Arquivos que serao ajustados:');
 planned.forEach(change=>console.log(' - '+path.relative(root,change.file)));
 if(!apply){console.log('Somente verificacao. Para aplicar: node scripts/patch-staging-canonical.cjs --apply');return;}
 const done=[];
 try{
   for(const change of planned){
     const backup=change.file+'.antes-v143.bak';
     fs.copyFileSync(change.file,backup,fs.constants.COPYFILE_EXCL);
     fs.writeFileSync(change.file,change.contents,'utf8');
     done.push({file:change.file,backup});
     console.log('Atualizado: '+path.relative(root,change.file));
   }
 }catch(e){
   for(const d of done.reverse())fs.copyFileSync(d.backup,d.file);
   throw e;
 }
 console.log('Concluido. Execute npm run build, npm run check:release e npm test; nao publique se houver falhas.');
}
try{main()}catch(e){console.error(e.message);process.exitCode=1;}
