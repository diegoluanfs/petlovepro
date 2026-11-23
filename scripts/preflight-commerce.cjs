#!/usr/bin/env node
'use strict';
/** Read-only deployed-site audit. No Firebase, Kiwify or Google credentials. */
const {auditSite}=require('../src/preflight-commerce-core.cjs');
const base=process.argv.find(x=>x.startsWith('--base='))?.slice(7)||'https://petlovepro.com.br';
auditSite(base).then(result=>{
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}).catch(e=>{console.error('Preflight falhou:',e.message);process.exitCode=1});
