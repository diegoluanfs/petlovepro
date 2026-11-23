#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const target=path.join(root,'web','app.js');
if(!fs.existsSync(target))throw Error('web/app.js não encontrado. Interrompido para proteger o código existente.');
let source=fs.readFileSync(target,'utf8');
const marker='// PLP Firebase commerce library v1.3';
if(source.includes(marker)){console.log('Frontend já atualizado, sem mudanças.');process.exit(0)}
const where='function account(){';
const accountAnchor='<section class="account-main"><h2>Minhas compras</h2>';
if(source.split(where).length!==2||source.split(accountAnchor).length!==2)throw Error('Versão do frontend não reconhecida. Não houve modificações.');
const render=`${marker}\nfunction libraryHTML(lib){\n  if(!lib||!Array.isArray(lib.bookIds)||lib.bookIds.length===0)return '';\n  const names=lib.bookIds.map(id=>({id,p:find(id)})).filter(x=>x.p);\n  if(!names.length)return '';\n  const member=state.seller.memberUrl||'https://dashboard.kiwify.com.br/courses';\n  return '<section class="info-box" style="margin-bottom:22px"><h2>Minha biblioteca · '+names.length+' e-book(s)</h2><p>Livros identificados a partir das compras aprovadas. Os PDFs integrais continuam protegidos na Kiwify.</p><ul style="margin:14px 0;padding-left:20px">'+names.map(x=>'<li><a href="#/livro/'+esc(x.id.slice(-3))+'">'+esc(x.p.title)+'</a></li>').join('')+'</ul><a class="button primary" href="'+esc(member)+'" target="_blank" rel="noopener noreferrer">Acessar meus materiais na Kiwify ↗</a></section>';\n}\n`;
source=source.replace(where,render+where);
source=source.replace(accountAnchor,'<section class="account-main">${libraryHTML(state.account?.library)}<h2>Minhas compras</h2>');
const backup=path.join(root,'.petlovepro-backups');fs.mkdirSync(backup,{recursive:true});
const dst=path.join(backup,'app-antes-library-'+new Date().toISOString().replace(/[:.]/g,'-')+'.js');
fs.copyFileSync(target,dst);
fs.writeFileSync(target,source,'utf8');
console.log('Frontend atualizado. Backup em '+dst);
