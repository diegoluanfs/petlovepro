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
 for(const d of ['scripts','web','public','site-dist','temp'])fs.mkdirSync(path.join(home,d),{recursive:true});
 fs.copyFileSync(source,path.join(home,'scripts/stage-cloudflare-canonical.cjs'));
 const web="(function(){console.log(window.PETLOVEPRO_FIREBASE)})()";
 fs.writeFileSync(path.join(home,'web/app.js'),web);
 fs.writeFileSync(path.join(home,'site-dist/app.js'),web);
 const canonicalHtml='<script src="/firebase-config.js" defer></script><script src="/app.js" defer></script>';
 fs.writeFileSync(path.join(home,'index.html'),canonicalHtml);
 fs.writeFileSync(path.join(home,'site-dist/index.html'),canonicalHtml);
 const legacy=`const firebaseConfig = 'broken';`;
 fs.writeFileSync(path.join(home,'scripts/stage-cloudflare.cjs'),`'use strict';const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');const parent=process.argv[2];const dir=fs.mkdtempSync(path.join(parent,'petlovepro-pages-'));fs.writeFileSync(path.join(dir,'index.html'),'<script src="/firebase-config.js" defer></script><script src="/app.js" defer></script>');fs.writeFileSync(path.join(dir,'firebase-config.js'),'window.PETLOVEPRO_FIREBASE={apiKey:"x"};');fs.writeFileSync(path.join(dir,'app.js'),${JSON.stringify(legacy)});console.log(dir);`);
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
  const text=fs.readFileSync(legacy,'utf8').replace('<script src="/firebase-config.js" defer></script><script src="/app.js" defer></script>','<script src="/app.js" defer></script><script src="/firebase-config.js" defer></script>');
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
