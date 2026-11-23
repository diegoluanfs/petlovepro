#!/usr/bin/env node
'use strict';
/*
 * Sincronização administrativa EXPLÍCITA: 60 ofertas Kiwify -> commercialProducts.
 * Por padrão SOMENTE analisa arquivos locais. --remote lê Firestore.
 * --apply grava apenas com confirmação de projeto e não altera coleções de usuários,
 * regras, Functions ou qualquer produto da Kiwify.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const project='petlovepro-ae222';
const args=process.argv.slice(2);
const flag=k=>args.includes(k);
const projectArg=args.find(x=>x.startsWith('--project='))?.slice('--project='.length);
const local=JSON.parse(fs.readFileSync(path.join(root,'dist','firestore-commerce-plan.private.json'),'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'data','release-policy.json'),'utf8'));
const errs=[];
const ids=new Set(),kiwifyIds=new Set(),offers=new Set(),links=new Set();
for(const p of local){
  if(ids.has(p.id)||kiwifyIds.has(p.kiwifyProductId)||offers.has(p.kiwifyOfferId)||links.has(p.checkout))errs.push('ID, oferta ou link duplicado: '+p.id);
  ids.add(p.id);kiwifyIds.add(p.kiwifyProductId);offers.add(p.kiwifyOfferId);links.add(p.checkout);
  if(!/^(book-\d{3}|collection-\d{2})$/.test(p.id))errs.push('ID inválido: '+p.id);
  if(p.currency!=='BRL'||p.price!==(p.kind==='book'?2490:7990)||p.offerPriceCents!==p.price||p.offerVerified!==true||p.offerActive!==true||p.live!==true)errs.push('Oferta inválida: '+p.id);
  if(!/^https:\/\/pay\.kiwify\.com\.br\/[A-Za-z0-9]+$/.test(p.checkout))errs.push('URL inválida: '+p.id);
  if(policy.productCheckoutUrls?.[p.id]!==p.checkout||policy.productOfferIds?.[p.id]!==p.kiwifyOfferId)errs.push('Divergência com a auditoria Kiwify: '+p.id);
  if(p.kind==='collection'&&(!Array.isArray(p.volumeIds)||p.volumeIds.length!==5||new Set(p.volumeIds).size!==5||p.volumeIds.some(id=>!local.some(x=>x.id===id&&x.kind==='book'))))errs.push('Coleção inválida: '+p.id);
}
if(local.length!==60||ids.size!==60||local.filter(p=>p.kind==='book').length!==50||local.filter(p=>p.kind==='collection').length!==10)errs.push('Esperados exatamente 50 livros e 10 coleções.');
if(errs.length){console.error(errs.join('\n'));process.exit(1);}
const records=local.map(p=>({...p,offerActive:true,offerVerified:true,offerPriceCents:p.price,updatedBy:'petlovepro-commerce-v1.3'}));
console.log(`CATÁLOGO VÁLIDO: ${records.length} ofertas (50 livros / 10 coleções).`);
if(!flag('--remote')&&!flag('--apply')){console.log('MODO LOCAL: nenhum acesso ao Firebase. Para comparar: --remote --project=petlovepro-ae222');process.exit(0)}
if(projectArg!==project)throw Error('Indique exatamente --project=petlovepro-ae222');
if(flag('--apply')&&process.env.PLP_CONFIRM_FIRESTORE_SYNC!==project)throw Error('Para gravar, defina PLP_CONFIRM_FIRESTORE_SYNC=petlovepro-ae222 antes de --apply.');
let admin;
try {admin=require('../functions-petlovepro/node_modules/firebase-admin');}
catch {throw Error('Firebase Admin não instalado. Execute npm --prefix functions-petlovepro install.');}
if(!admin.apps.length)admin.initializeApp({projectId:project,credential:admin.credential.applicationDefault()});
(async()=>{
 const db=admin.firestore();
 const refs=records.map(p=>db.collection('commercialProducts').doc(p.id));
 const remote=await db.getAll(...refs);
 const conflicts=[];
 let newDocs=0,changedDocs=0;
 const safeChange=[];
 for(let i=0;i<records.length;i++){
   const old=remote[i].exists?remote[i].data():null,p=records[i];
   if(!old){newDocs++;continue;}
   if(old.kiwifyProductId&&old.kiwifyProductId!==p.kiwifyProductId)conflicts.push(`${p.id}: ID Kiwify divergente`);
   if(old.kiwifyOfferId&&old.kiwifyOfferId!==p.kiwifyOfferId)conflicts.push(`${p.id}: oferta divergente`);
   if(old.checkout&&old.checkout!==p.checkout)conflicts.push(`${p.id}: destino do checkout divergente`);
   if(old.price!==undefined&&old.price!==p.price)conflicts.push(`${p.id}: preço divergente`);
   if(old.currency&&old.currency!=='BRL')conflicts.push(`${p.id}: moeda divergente`);
   if(old.kind&&old.kind!==p.kind)conflicts.push(`${p.id}: tipo divergente`);
   if(old.kind==='collection'&&old.volumeIds&&JSON.stringify(old.volumeIds)!==JSON.stringify(p.volumeIds))conflicts.push(`${p.id}: composição da coleção divergente`);
   if(old.live!==true||old.offerActive!==true)changedDocs++;
 }
 console.log(JSON.stringify({project,exists:remote.length-newDocs,newDocs,needActivation:changedDocs,conflicts},null,2));
 if(conflicts.length)throw Error('Conflitos remotos: nada foi gravado. Corrija e audite antes da publicação.');
 if(!flag('--apply')){console.log('SOMENTE LEITURA: sem gravações remotas.');return;}
 const batch=db.batch();
 records.forEach((p,i)=>batch.set(refs[i],p,{merge:true}));
 await batch.commit();
 console.log(`SINCRONIZADOS: ${records.length} registros em commercialProducts. Webhooks e usuários NÃO alterados.`);
})().catch(e=>{console.error('ERRO:',e.message);process.exitCode=1});
