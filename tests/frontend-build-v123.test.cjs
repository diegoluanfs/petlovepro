'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),site=path.join(root,'site-dist');
for(const [input,output] of [['index.html','index.html'],['web/app.js','app.js'],['web/style.css','style.css']]){
 test('build v1.2.3: '+output+' publicado corresponde ao arquivo-fonte vigente',()=>{
  const actual=fs.readFileSync(path.join(site,output),'utf8');
  const expected=fs.readFileSync(path.join(root,input),'utf8');
  assert.equal(actual,expected,'Arquivo em site-dist/ pode ter sido sobrescrito por public/ legado: '+output);
 });
}
test('build v1.2.3: app de compra integrado, nao apenas links decorativos',()=>{
  const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
  const app=fs.readFileSync(path.join(site,'app.js'),'utf8');
  for(const part of ['catalog-commerce.js','firebase-config.js','commerce-client.js','app.js'])assert.ok(html.includes(part),'HTML sem '+part);
  for(const part of ['Comprar na Kiwify','Acessar meu e-book','Minhas compras','Preciso de ajuda com meu acesso','privacidade','viewItem'])assert.ok(app.includes(part),'App sem '+part);
});
