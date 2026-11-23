#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const policy=JSON.parse(fs.readFileSync(path.join(root,'data/release-policy.json'),'utf8'));
const legal=JSON.parse(fs.readFileSync(path.join(root,'data/legal-approval.json'),'utf8'));
const {sellerReadiness}=require('../src/seller.cjs');
const failures=sellerReadiness(policy);
for(const key of ['termsApproved','privacyApproved','supportChannelVerified'])if(legal[key]!==true)failures.push(`${key}: falta validação efetiva`);
const firebaseText=fs.readFileSync(path.join(root,'public/firebase-config.js'),'utf8');
if(/apiKey:\s*''/.test(firebaseText)||/projectId:\s*''/.test(firebaseText))failures.push('Firebase Web não foi vinculado ao projeto');
if(failures.length){console.error('BLOQUEIO DE PUBLICAÇÃO ('+failures.length+' pendências):\n- '+failures.join('\n- '));process.exitCode=1}
else console.log('Etapa documental e configuração concluídas. Executar homologação real de checkout, Kiwify, Firestore e GA4 antes do deploy.');
