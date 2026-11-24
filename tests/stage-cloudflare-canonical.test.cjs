'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const source=path.resolve(__dirname,'../scripts/stage-cloudflare-canonical.cjs');
function fixture(){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'petlovepro-stage-test-'));
 for(const d of ['scripts','web','public','site-dist','dist','temp'])fs.mkdirSync(path.join(home,d),{recursive:true});
 fs.copyFileSync(source,path.join(home,'scripts/stage-cloudflare-canonical.cjs'));
 const web="(function(){console.log(window.PETLOVEPRO_FIREBASE)})()";
 fs.writeFileSync(path.join(home,'web/app.js'),web);
 fs.writeFileSync(path.join(home,'site-dist/app.js'),web);
 const canonicalHtml='<link rel="stylesheet" href="/style.css"><link rel="icon" href="/favicon.svg"><script src="/firebase-config.js" defer></script><script src="/catalog-commerce.js" defer></script><script src="/commerce-client.js" defer></script><script src="/app.js" defer></script>';
 fs.writeFileSync(path.join(home,'index.html'),canonicalHtml);
 fs.writeFileSync(path.join(home,'site-dist/index.html'),canonicalHtml);
 const base = path.join(home,'site-dist');
 const items = [
   ...Array.from({length:50},(_,i)=>({id:'book-'+String(i+1).padStart(3,'0'),kind:'book'})),
   ...Array.from({length:10},(_,i)=>({id:'collection-'+String(i+1).padStart(2,'0'),kind:'collection'}))
 ];
 fs.writeFileSync(path.join(base,'style.css'),'body { color: #123; }');
 fs.writeFileSync(path.join(base,'firebase-config.js'),'window.PETLOVEPRO_FIREBASE={apiKey:"x"};');
 fs.writeFileSync(path.join(base,'catalog-commerce.js'),'window.PetLoveProCommerceCatalog={};');
 fs.writeFileSync(path.join(base,'catalog-commerce.json'),JSON.stringify({items}));
 fs.writeFileSync(path.join(base,'site-data.json'),JSON.stringify({books:items.slice(0,50),collections:items.slice(50)}));
 fs.writeFileSync(path.join(base,'catalog.js'),'window.PetLoveProCatalog={};');
 fs.writeFileSync(path.join(base,'commerce-client.js'),'window.PetLoveProCommerceClient={};');
 fs.writeFileSync(path.join(base,'seller-public.json'),'{}');
 fs.writeFileSync(path.join(base,'favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 for(const f of ['style.css','catalog-commerce.js','catalog-commerce.json']) { const origin=f==='style.css'?'web':'dist'; fs.copyFileSync(path.join(base,f),path.join(home,origin,f)); }
 fs.mkdirSync(path.join(base,'assets'));
 fs.mkdirSync(path.join(base,'previews'));
 for(let i=1;i<=50;i++){
   const num=String(i).padStart(3,'0');
   fs.writeFileSync(path.join(base,'assets','book-'+num+'.webp'),'PUBLIC COVER '+num);
   fs.writeFileSync(path.join(base,'previews','book-'+num+'.pdf'),'%PDF-1.4 PUBLIC PREVIEW '+num);
 }
 for(let i=1;i<=10;i++)fs.writeFileSync(path.join(base,'assets','collection-'+String(i).padStart(2,'0')+'.webp'),'COLLECTION');
 fs.mkdirSync(path.join(home,'public','assets'),{recursive:true});
 for (const name of fs.readdirSync(path.join(base,'assets'))) fs.copyFileSync(path.join(base,'assets',name),path.join(home,'public','assets',name));
 const legacy=`const firebaseConfig = 'broken';`;
 fs.writeFileSync(path.join(home,'scripts/stage-cloudflare.cjs'),`'use strict';const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const parent=process.argv[2];const dir=fs.mkdtempSync(path.join(parent,'petlovepro-pages-'));fs.writeFileSync(path.join(dir,'index.html'),${JSON.stringify(canonicalHtml)});fs.writeFileSync(path.join(dir,'firebase-config.js'),'window.PETLOVEPRO_FIREBASE={apiKey:"x"};');fs.writeFileSync(path.join(dir,'app.js'),${JSON.stringify(legacy)});console.log(dir);`);
 return {home,web};
}
test('staging overlays only the canonical build, preserving the legacy source',()=>{
 const {home,web}=fixture();
 try{
  const result=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const out=result.stdout.trim();
  assert.equal(fs.readFileSync(path.join(out,'app.js'),'utf8'),web);
  assert.match(result.stderr,/alinhado ao frontend canonico/);
  assert.ok(fs.readFileSync(path.join(home,'scripts/stage-cloudflare.cjs'),'utf8').includes('petlovepro-pages-'));
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('staging fails closed when build disagrees with source',()=>{
 const {home}=fixture();
 try{
  fs.writeFileSync(path.join(home,'site-dist/app.js'),'WRONG');
  const result=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/difere de web\/app.js/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('staging repairs a stale HTML load order using canonical build',()=>{
 const {home}=fixture();
 try{
  const legacy=path.join(home,'scripts/stage-cloudflare.cjs');
  const text=fs.readFileSync(legacy,'utf8').replace(JSON.stringify(fs.readFileSync(path.join(home,'index.html'),'utf8')), JSON.stringify('<script src="/app.js" defer></script><script src="/firebase-config.js" defer></script>'));
  fs.writeFileSync(legacy,text);
  const result=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const deploy=result.stdout.trim();
  assert.equal(fs.readFileSync(path.join(deploy,'index.html'),'utf8'),fs.readFileSync(path.join(home,'index.html'),'utf8'));
  assert.match(result.stderr,/index.html do staging alinhado/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging preserves an error from the original validator',()=>{
 const {home}=fixture();
 try{
  fs.writeFileSync(path.join(home,'scripts/stage-cloudflare.cjs'),'process.stderr.write("Unapproved paid PDF\\n"); process.exit(2);');
  const result=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Validador original recusou/);
  assert.match(result.stderr,/Unapproved paid PDF/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});


test('staging blocks a canonical HTML with wrong script order',()=>{
 const {home}=fixture();
 try{
  const broken='<script src="/app.js"></script><script src="/firebase-config.js"></script>';
  fs.writeFileSync(path.join(home,'index.html'),broken);
  fs.writeFileSync(path.join(home,'site-dist/index.html'),broken);
  const result=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/HTML canonico nao carrega/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('staging blocks a build with stale HTML',()=>{
 const {home}=fixture();
 try{
  fs.writeFileSync(path.join(home,'site-dist/index.html'),'different');
  const result=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/site-dist\/index.html diverge/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('staging contains CSS, two catalogs, public images and 50 PDF previews',()=>{
 const {home}=fixture();
 try {
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const dir=r.stdout.trim();
  for(const file of ['index.html','app.js','style.css','catalog-commerce.js','catalog-commerce.json','site-data.json','commerce-client.js','firebase-config.js','seller-public.json','favicon.svg','assets/book-001.webp','assets/book-050.webp','assets/collection-10.webp','previews/book-050.pdf']){
   assert.ok(fs.existsSync(path.join(dir,file)),file+' missing');
   assert.deepEqual(fs.readFileSync(path.join(dir,file)),fs.readFileSync(path.join(home,'site-dist',file)),file+' differs');
  }
  assert.match(r.stderr,/CSS, catalogo e dados editoriais/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging rejects missing CSS from canonical build',()=>{
 const {home}=fixture();
 try {
  fs.rmSync(path.join(home,'site-dist/style.css'));
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/style.css/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging rejects missing promotional preview instead of publishing incomplete',()=>{
 const {home}=fixture();
 try {
  fs.rmSync(path.join(home,'site-dist/previews/book-022.pdf'));
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/previews\\book-022.pdf|previews\/book-022.pdf/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging rejects invalid CSS delivered as HTML',()=>{
 const {home}=fixture();
 try {
  fs.writeFileSync(path.join(home,'site-dist/style.css'),'<html>invalid</html>');
  fs.writeFileSync(path.join(home,'web/style.css'),'<html>invalid</html>');
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/style.css ausente ou invalido/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging rejects catalog with missing products',()=>{
 const {home}=fixture();
 try {
  fs.writeFileSync(path.join(home,'site-dist/catalog-commerce.json'),JSON.stringify({items:[]}));
  fs.writeFileSync(path.join(home,'dist/catalog-commerce.json'),JSON.stringify({items:[]}));
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/50 livros e 10 colecoes/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging never copies unrelated private files from site-dist',()=>{
 const {home}=fixture();
 try {
  fs.writeFileSync(path.join(home,'site-dist/secret-file.json'),'{"private":true}');
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  assert.equal(fs.existsSync(path.join(r.stdout.trim(),'secret-file.json')),false);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});

test('staging rejects a stale stylesheet even if a CSS file exists',()=>{
 const {home}=fixture();
 try {
  fs.writeFileSync(path.join(home,'site-dist/style.css'),'body { color: red; }');
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/style.css difere de web\/style.css/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});
test('staging rejects mismatched commerce catalog build',()=>{
 const {home}=fixture();
 try {
  fs.writeFileSync(path.join(home,'dist/catalog-commerce.js'),'window.PetLoveProCommerceCatalog={changed:1};');
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/catalog-commerce.js difere de dist\/catalog-commerce.js/);
 } finally {fs.rmSync(home,{recursive:true,force:true});}
});

test('staging includes legitimate nested public covers from the audited build',()=>{
 const {home}=fixture();
 try {
  for(const base of ['site-dist','public']) fs.mkdirSync(path.join(home,base,'assets/covers'),{recursive:true});
  const cover='COVER-SAMPLE-CONTENT';
  const svg='<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>';
  for(const base of ['site-dist','public']){
   fs.writeFileSync(path.join(home,base,'assets/covers','guia-de-pets.webp'),cover);
   fs.writeFileSync(path.join(home,base,'assets/covers','pet-tips.svg'),svg);
  }
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const dir=r.stdout.trim();
  assert.equal(fs.readFileSync(path.join(dir,'assets/covers/guia-de-pets.webp'),'utf8'),cover);
  assert.equal(fs.readFileSync(path.join(dir,'assets/covers/pet-tips.svg'),'utf8'),svg);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('staging refuses any paid PDF disguised as a public cover',()=>{
 const {home}=fixture();
 try {
  for(const base of ['site-dist','public']){
   fs.mkdirSync(path.join(home,base,'assets/covers'),{recursive:true});
   fs.writeFileSync(path.join(home,base,'assets/covers','full-book.pdf'),'%PDF PRIVATE');
  }
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Imagem nao autorizada.*full-book\.pdf/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('staging rejects a nested image missing from public source',()=>{
 const {home}=fixture();
 try {
  fs.mkdirSync(path.join(home,'site-dist/assets/covers'),{recursive:true});
  fs.writeFileSync(path.join(home,'site-dist/assets/covers','injected.webp'),'UNKNOWN');
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Subpasta de imagem nao autorizada.*covers/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('staging rejects nested images modified after build',()=>{
 const {home}=fixture();
 try {
  for(const base of ['site-dist','public']) fs.mkdirSync(path.join(home,base,'assets/covers'),{recursive:true});
  fs.writeFileSync(path.join(home,'public/assets/covers','guide.webp'),'PUBLIC IMAGE');
  fs.writeFileSync(path.join(home,'site-dist/assets/covers','guide.webp'),'ALTERED IMAGE');
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Imagem difere da origem publica.*guide\.webp/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

test('staging refuses SVG assets containing executable script',()=>{
 const {home}=fixture();
 try {
  const active='<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  for(const base of ['site-dist','public']){
   fs.mkdirSync(path.join(home,base,'assets/covers'),{recursive:true});
   fs.writeFileSync(path.join(home,base,'assets/covers','unsafe.svg'),active);
  }
  const r=spawnSync(process.execPath,[path.join(home,'scripts/stage-cloudflare-canonical.cjs'),path.join(home,'temp')],{encoding:'utf8'});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/SVG ativo ou inseguro.*unsafe\.svg/);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
