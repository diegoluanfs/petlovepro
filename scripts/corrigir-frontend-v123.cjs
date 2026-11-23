#!/usr/bin/env node
'use strict';
// Corrige a prioridade dos arquivos do novo frontend sem alterar public/, Firebase, Kiwify ou Cloudflare.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'scripts','build-site.cjs');
const source=[
  {file:'index.html',tokens:['catalog-commerce.js','firebase-config.js','commerce-client.js','app.js']},
  {file:'web/app.js',tokens:['Comprar na Kiwify','Acessar meu e-book','Minhas compras','Preciso de ajuda com meu acesso','privacidade','viewItem']},
  {file:'web/style.css',tokens:[]},
];
function abort(message){console.error('[PetLovePro v1.2.3] '+message);process.exit(1)}
if(!fs.existsSync(target))abort('scripts/build-site.cjs ausente. Extraia na raiz do projeto.');
for(const s of source){const p=path.join(root,s.file);if(!fs.existsSync(p))abort('Arquivo da aplicacao v1.2.0 ausente: '+s.file);const contents=fs.readFileSync(p,'utf8');for(const needle of s.tokens)if(!contents.includes(needle))abort('Arquivo '+s.file+' nao possui a integracao esperada: '+needle+'. Nao apliquei correcao.');}
const original=fs.readFileSync(target,'utf8');
const anchor="recursive(path.join(root,'public'),output);";
const marker='// PETLOVEPRO_V123_FRONTEND_PRECEDENCE';
const safeBlock=`\n${marker}\n// A pasta public/ e legado de hospedagem e pode conter index.html/app.js antigos.\n// O frontend vigente DEVE prevalecer depois da copia de public/; nao remove arquivos publicos.\ncopy(path.join(root,'index.html'),path.join(output,'index.html'));\ncopy(path.join(root,'web/style.css'),path.join(output,'style.css'));\ncopy(path.join(root,'web/app.js'),path.join(output,'app.js'));\n`;
if(original.includes(marker)){
  if(!original.includes(anchor))abort('Marcador de correcao detectado mas ancora original nao existe. Revisao manual necessaria.');
  console.log('Correcao v1.2.3 ja aplicada. Nenhum arquivo alterado.');
  process.exit(0);
}
if(original.split(anchor).length!==2)abort('Formato do gerador nao reconhecido (ancora ausente ou repetida). Nenhuma alteracao realizada.');
if(!original.includes("copy(path.join(root,'index.html'),path.join(output,'index.html'));"))abort('Fonte de entrada HTML desconhecida. Nao vou adivinhar nem alterar o build.');
if(!original.includes("copy(path.join(root,'web/app.js'),path.join(output,'app.js'));"))abort('Fonte de entrada JS desconhecida. Nao vou adivinhar nem alterar o build.');
if(!original.includes('function copy('))abort('Funcao copy() nao identificada. Nenhuma alteracao.');
const updated=original.replace(anchor,anchor+safeBlock);
if(process.argv.includes('--check')){console.log('Prevalidacao OK: correcao pode ser aplicada ao build atual.');process.exit(0)}
const backup=target+'.antes-v123.bak';
if(fs.existsSync(backup))abort('Backup antigo '+path.basename(backup)+' ja existe. Interrompido para nao sobrescrever backup anterior.');
fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);
try{fs.writeFileSync(target,updated,'utf8');console.log('Build corrigido. Backup: '+path.relative(root,backup));}
catch(e){try{fs.copyFileSync(backup,target)}catch{}abort('Nao consegui gravar o build: '+e.message)}
