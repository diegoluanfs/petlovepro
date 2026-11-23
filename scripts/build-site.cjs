#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=path.join(root,'site-dist');
execFileSync(process.execPath,[path.join(root,'scripts/build-catalog.cjs')],{stdio:'inherit'});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'dist/catalog-commerce.json'),'utf8'));
const editorial=JSON.parse(fs.readFileSync(path.join(root,'data/editorial-catalog.json'),'utf8'));
if(fs.existsSync(output))fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
function copy(src,dst){fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst)}
copy(path.join(root,'index.html'),path.join(output,'index.html'));
copy(path.join(root,'web/style.css'),path.join(output,'style.css'));
copy(path.join(root,'web/app.js'),path.join(output,'app.js'));
function recursive(src,dst){for(const dirent of fs.readdirSync(src,{withFileTypes:true})){
  const from=path.join(src,dirent.name),to=path.join(dst,dirent.name);
  if(dirent.isDirectory())recursive(from,to);else copy(from,to);
}}
recursive(path.join(root,'public'),output);
// PETLOVEPRO_V123_FRONTEND_PRECEDENCE
// A pasta public/ e legado de hospedagem e pode conter index.html/app.js antigos.
// O frontend vigente DEVE prevalecer depois da copia de public/; nao remove arquivos publicos.
copy(path.join(root,'index.html'),path.join(output,'index.html'));
copy(path.join(root,'web/style.css'),path.join(output,'style.css'));
copy(path.join(root,'web/app.js'),path.join(output,'app.js'));

copy(path.join(root,'dist/catalog-commerce.json'),path.join(output,'catalog-commerce.json'));
copy(path.join(root,'dist/catalog-commerce.js'),path.join(output,'catalog-commerce.js'));
const backwardCompat={version:catalog.version,books:catalog.items.filter(p=>p.kind==='book'),collections:catalog.items.filter(p=>p.kind==='collection'),items:catalog.items};
fs.writeFileSync(path.join(output,'catalog.js'),'window.PetLoveProCatalog='+JSON.stringify(backwardCompat)+';\n');
const policy=JSON.parse(fs.readFileSync(path.join(root,'data/release-policy.json'),'utf8'));
const sellerPublic={brand:'PetLovePro',legalName:policy.seller?.legalName||null,document:policy.seller?.document||null,
  businessAddress:policy.seller?.address||null,supportEmail:policy.seller?.supportEmail||null,
  memberUrl:policy.memberUrl,analyticsMeasurementId:policy.ga4MeasurementId,termsVersion:policy.version,privacyVersion:policy.version};
fs.writeFileSync(path.join(output,'seller-public.json'),JSON.stringify(sellerPublic,null,2)+'\n');
const safe={books:editorial.books.map(({id,volume,collection_id,title,subtitle,language,pages,benefits,description_short,description_long,related})=>({id,volume,collection_id,title,subtitle,language,pages,benefits,description_short,description_long,related})),
collections:editorial.collections.map(({id,title,volumes,books,pages})=>({id,title,volumes,books,pages}))};
fs.writeFileSync(path.join(output,'site-data.json'),JSON.stringify(safe,null,2)+'\n');
const assets=fs.readdirSync(path.join(output,'assets'));
const demos=fs.readdirSync(path.join(output,'previews')).filter(f=>f.endsWith('.pdf'));
if(assets.filter(f=>/^book-\d{3}\.webp$/.test(f)).length!==50||assets.filter(f=>/^collection-\d{2}\.webp$/.test(f)).length!==10||demos.length!==50)throw Error('Faltam capas ou amostras gratuitas');
if(catalog.items.length!==60||catalog.items.filter(p=>p.live).length!==60)throw Error('Política de liberação divergente: 60 ofertas ativas obrigatórias');
if(fs.existsSync(path.join(output,'firestore-commerce-plan.private.json')))throw Error('O plano comercial privado não pode ir ao site');
console.log(`Site preparado: ${catalog.items.length} produtos, ${assets.length} imagens, ${demos.length} amostras, 60 ofertas habilitadas. Pasta site-dist/`);
