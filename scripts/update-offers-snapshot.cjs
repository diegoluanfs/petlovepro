#!/usr/bin/env node
'use strict';
// Rebuilds the complete, PRIVATE validated checkout map from the seller snapshot.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {readJSON,readKiwifyTSV,normalize,COLLECTION_KIWIFY}=require('../src/catalog-core.cjs');
const editorial=readJSON(path.join(root,'data/editorial-catalog.json'));
const rows=readKiwifyTSV(path.join(root,'data/kiwify-products-verified.tsv'));
const byName=new Map(rows.map(p=>[normalize(p.title),p]));
const file=path.join(root,'data/kiwify-links-verified.txt');
const lines=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(x=>x.split('|'));
if(lines.length!==60||new Set(lines.map(x=>normalize(x[0]))).size!==60)throw Error('Links Kiwify devem ter exatamente 60 nomes distintos');
const byLinks=new Map(lines.map(([name,code,offerId])=>[normalize(name),{name,checkoutUrl:'https://pay.kiwify.com.br/'+code,offerId}]));
const matches=[];
for (const b of editorial.books) matches.push({id:b.id,title:b.title,commercialName:b.title,expectedPrice:2490});
for (let i=0;i<editorial.collections.length;i++){
  const c=editorial.collections[i];matches.push({id:c.id,title:c.title,commercialName:COLLECTION_KIWIFY[i],expectedPrice:7990});
}
const release=readJSON(path.join(root,'data/release-policy.json'));
const products=[];let missing=[];
for(const m of matches){
  const record=byName.get(normalize(m.commercialName)),link=byLinks.get(normalize(m.commercialName));
  if(!record||!link||record.priceCents!==m.expectedPrice||!/^https:\/\/pay\.kiwify\.com\.br\/[a-zA-Z0-9]+$/.test(link.checkoutUrl)||!/^[\da-f]{8}-[\da-f-]{27,}$/.test(link.offerId)){
    missing.push(`${m.id} ${m.commercialName}`);continue;
  }
  products.push({id:m.id,title:m.title,commercialName:m.commercialName,kiwifyProductId:record.productId,kiwifyOfferId:link.offerId,checkoutUrl:link.checkoutUrl,priceCents:record.priceCents,currency:'BRL',active:true,softBan:false});
}
if(missing.length||products.length!==60)throw Error('Mapeamento incompleto: '+missing.join(', '));
if(new Set(products.map(x=>x.checkoutUrl)).size!==60||new Set(products.map(x=>x.kiwifyOfferId)).size!==60||new Set(products.map(x=>x.kiwifyProductId)).size!==60)throw Error('Checkout, oferta ou produto duplicados');
const snapshot={verifiedAt:'2026-11-23',source:'Kiwify product_get: links, offers and product status; 50 ebooks + 10 collections',products};
fs.writeFileSync(path.join(root,'data/kiwify-offers-verified.private.json'),JSON.stringify(snapshot,null,2)+'\n');
release.version='2026-11-23';release.releaseOnly=products.map(x=>x.id);release.productCheckoutUrls=Object.fromEntries(products.map(x=>[x.id,x.checkoutUrl]));release.productOfferIds=Object.fromEntries(products.map(x=>[x.id,x.kiwifyOfferId]));
fs.writeFileSync(path.join(root,'data/release-policy.json'),JSON.stringify(release,null,2)+'\n');
console.log('60 ofertas e 60 links oficiais mapeados; política de catálogo atualizada, nenhum acesso remoto alterado.');
