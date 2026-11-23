#!/usr/bin/env node
'use strict';
// Simulação por padrão; não sincroniza em produção sem liberação explícita.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'dist/firestore-commerce-plan.private.json');
const list=JSON.parse(fs.readFileSync(file,'utf8'));
const policy=JSON.parse(fs.readFileSync(path.join(root,'data/release-policy.json'),'utf8'));
const records=list.map(p=>({...p,offerActive:p.live===true,offerPriceCents:p.live?p.price:null,
  memberUrl:p.memberUrl,updatedBy:'petlovepro-commerce-v1'}));
if(!process.argv.includes('--apply')){console.log(`DRY RUN: ${records.length} documentos em commercialProducts, ${records.filter(p=>p.live).length} liberados. Nenhuma alteração remota.`);process.exit(0)}
if(process.env.PETLOVEPRO_ALLOW_FIRESTORE_WRITE!=='YES')throw Error('Defina PETLOVEPRO_ALLOW_FIRESTORE_WRITE=YES explicitamente.');
if(!process.env.GOOGLE_CLOUD_PROJECT&&!process.env.GCLOUD_PROJECT&&!process.env.FIREBASE_PROJECT_ID)throw Error('Falta ID do projeto Firebase.');
const admin=require('../functions-petlovepro/node_modules/firebase-admin');
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID||process.env.GOOGLE_CLOUD_PROJECT});
(async()=>{
  const db=admin.firestore();
  // Bloqueio de regressão REAL no Firestore remoto, não apenas histórico local.
  const snapshots=await db.getAll(...records.map(p=>db.collection('commercialProducts').doc(p.id)));
  const failures=[];const rollbacks=new Set(policy.explicitRollbacks||[]);
  snapshots.forEach((snap,i)=>{if(!snap.exists)return;
    const was=snap.data(),next=records[i];
    if(was.live===true&&next.live!==true&&!rollbacks.has(next.id))failures.push(`${next.title}: já está liberado no Firestore e voltaria para Em breve`);
    if(was.live===true&&next.live===true&&was.price!==next.price)failures.push(`${next.title}: preço anterior ${was.price} e novo ${next.price} diferem`);
  });
  if(failures.length)throw Error('Publicação bloqueada por regressão comercial:\n- '+failures.join('\n- '));
  const batch=db.batch();for(const p of records)batch.set(db.collection('commercialProducts').doc(p.id),p,{merge:true});
  await batch.commit();console.log(`Firestore: ${records.length} documentos sincronizados; nenhuma regressão detectada.`);
})().catch(err=>{console.error(err.message);process.exitCode=1});
