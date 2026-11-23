#!/usr/bin/env node
'use strict';
// Read-only health report. Never displays buyer data or server secrets.
const {aggregateCommerceStatus,COLLECTIONS}=require('../src/commerce-status-core.cjs');
const project='petlovepro-ae222';
const projectArg=process.argv.find(x=>x.startsWith('--project='))?.slice('--project='.length);
if(projectArg!==project){console.error('Indique exatamente --project=petlovepro-ae222');process.exit(1)}
const sampleLimit=100;
let admin;
try{admin=require('../functions-petlovepro/node_modules/firebase-admin')}
catch{console.error('Instale dependencias com npm --prefix functions-petlovepro install');process.exit(1)}
if(!admin.apps.length)admin.initializeApp({projectId:project,credential:admin.credential.applicationDefault()});
(async()=>{
 const db=admin.firestore();const entries={};
 for(const collection of COLLECTIONS){
   const snap=await db.collection(collection).limit(sampleLimit+1).get();
   entries[collection]=snap.docs.map(x=>x.data());
 }
 console.log(JSON.stringify(aggregateCommerceStatus(entries,{sampleLimit}),null,2));
 console.log('MODO SOMENTE LEITURA: nenhuma gravacao foi feita.');
})().catch(e=>{console.error('Erro na auditoria:',e?.code||e?.name);process.exitCode=1});
