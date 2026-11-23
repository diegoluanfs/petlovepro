#!/usr/bin/env node
'use strict';
const path=require('node:path');const fs=require('node:fs');
const {readJSON,readKiwifyTSV,compile,auditPrivateRecords}=require('../src/catalog-core.cjs');
const root=path.resolve(__dirname,'..');
const {auditOfficialOffers}=require('../src/kiwify-link-audit.cjs');
const data=readJSON(path.join(root,'data/editorial-catalog.json'));
const releases=readJSON(path.join(root,'data/release-policy.json'));
const verified=readKiwifyTSV(path.join(root,'data/kiwify-products-verified.tsv'));
const previous=fs.existsSync(path.join(root,'data/previous-live.json'))?readJSON(path.join(root,'data/previous-live.json')):[];
const result=compile(data,verified,releases,previous);
result.issues.push(...auditPrivateRecords(result.products));
result.issues.push(...auditOfficialOffers(result.products,releases,readJSON(path.join(root,'data/kiwify-offers-verified.private.json'))));
if(result.issues.length){console.error(result.issues.join('\n'));process.exit(1);}
const outDir=path.join(root,'dist');fs.mkdirSync(outDir,{recursive:true});
const publicData={version:releases.version,items:result.products.map(({kiwifyProductId,kiwifyOfferId,offerVerified,offerActive,offerPriceCents,checkout,...safe})=>safe)};
fs.writeFileSync(path.join(outDir,'catalog-commerce.json'),JSON.stringify(publicData,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'catalog-commerce.js'),'(function(){"use strict";window.PetLoveProCommerceCatalog='+JSON.stringify(publicData)+';document.dispatchEvent(new CustomEvent("petlovepro:commerce-catalog",{detail:window.PetLoveProCommerceCatalog}));})();\n');
// Documento privado para a sincronização administrativa; NÃO servir pela CDN.
fs.writeFileSync(path.join(outDir,'firestore-commerce-plan.private.json'),JSON.stringify(result.products,null,2)+'\n');
console.log(`OK: ${result.products.length} produtos, ${result.products.filter(p=>p.live).length} liberado(s), ${result.products.filter(p=>!p.live).length} em breve`);
