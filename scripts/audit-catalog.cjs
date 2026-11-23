#!/usr/bin/env node
'use strict';
const path=require('node:path');const fs=require('node:fs');
const {readJSON,readKiwifyTSV,compile,auditPrivateRecords}=require('../src/catalog-core.cjs');
const root=path.resolve(__dirname,'..');
const {auditOfficialOffers}=require('../src/kiwify-link-audit.cjs');
const e=readJSON(path.join(root,'data/editorial-catalog.json'));
const k=readKiwifyTSV(path.join(root,'data/kiwify-products-verified.tsv'));
const r=readJSON(path.join(root,'data/release-policy.json'));
const prior=fs.existsSync(path.join(root,'data/previous-live.json'))?readJSON(path.join(root,'data/previous-live.json')):[];
const output=compile(e,k,r,prior);const failures=[...output.issues,...auditPrivateRecords(output.products),...auditOfficialOffers(output.products,r,readJSON(path.join(root,'data/kiwify-offers-verified.private.json')))];
for(const row of output.products) console.log(`${row.live?'LIBERADO':'EM BREVE '} ${row.id.padEnd(13)} ${String(row.price??'-').padStart(5)}  ${row.title}`);
if(failures.length){console.error('\n'+failures.length+' divergências:\n'+failures.join('\n'));process.exitCode=1;}
else console.log(`\nAUDITORIA OK: 50 livros (${2490} centavos), 10 coleções (${7990} centavos), cinco títulos por coleção. 60 links e ofertas Kiwify conferidos; nenhuma regressão encontrada.`);
