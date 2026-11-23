'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}

test('production build uses the canonical storefront, not the legacy module',()=>{
  const canonical=read('web/app.js');
  const generated=read('site-dist/app.js');
  assert.equal(generated,canonical);
  assert.match(generated,/PETLOVEPRO_FIREBASE/);
  assert.doesNotMatch(generated,/import\s*\{[^}]*firebaseConfig[^}]*\}\s*from\s*['"]\.\/firebase-config\.js['"]/);
});

test('source and generated HTML load Firebase configuration before storefront',()=>{
  for(const file of ['index.html','site-dist/index.html']){
    const html=read(file);
    const config=html.indexOf('/firebase-config.js');
    const app=html.indexOf('/app.js');
    assert.ok(config>=0 && app>=0 && config<app, file+' loads app before Firebase config');
  }
  assert.match(read('public/firebase-config.js'),/PETLOVEPRO_FIREBASE/);
});
