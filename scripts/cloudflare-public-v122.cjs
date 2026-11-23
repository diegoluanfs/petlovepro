'use strict';
/*
 * PetLovePro 1.2.2 - verificador complementar, sem remover a verificação legada.
 * Só trata mensagens exatas geradas pelo assertPublic original, e somente para
 * arquivos públicos esperados na atualização 1.2.0.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT_FILES = new Set([
  'commerce-client.js', 'favicon.svg', 'preview.html', 'seller-public.json',
  'app.js', 'catalog.js', 'catalog-commerce.js', 'catalog-commerce.json',
  'firebase-config.js', 'site-data.json', 'style.css', 'styles.css',
]);
const MAX_SIZE = {webp:4*1024*1024,pdf:4*1024*1024,js:2*1024*1024,json:1024*1024,html:1024*1024,svg:256*1024,css:1024*1024};
const PUBLIC_ROOT = path.resolve(__dirname, '..', 'public');
const isCover = value => /^assets\/(?:book-(?:00[1-9]|0[1-4][0-9]|050)|collection-(?:0[1-9]|10))\.webp$/.test(value);
const isPreview = value => /^previews\/book-(?:00[1-9]|0[1-4][0-9]|050)\.pdf$/.test(value);
const allowedFile = value => ROOT_FILES.has(value) || isCover(value) || isPreview(value);

function normalize(value) {
  const name = String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//,'');
  if(!name || name.startsWith('/') || name.includes('\0') || name.split('/').some(s=>!s||s==='.'||s==='..'||s.startsWith('.'))) return null;
  return name;
}

function validateFile(root, relative) {
  if(!allowedFile(relative)) throw Error('Arquivo não aprovado para publicação: '+relative);
  const full=path.join(root,...relative.split('/'));
  const st=fs.lstatSync(full);
  if(!st.isFile() || st.isSymbolicLink()) throw Error('Link ou diretório indevido: '+relative);
  const ext=path.extname(full).slice(1);
  if(!Object.hasOwn(MAX_SIZE, ext) || st.size<1 || st.size>MAX_SIZE[ext]) throw Error('Extensão/tamanho impróprio: '+relative);
  const buf=fs.readFileSync(full);
  if(ext==='webp' && (buf.toString('ascii',0,4)!=='RIFF'||buf.toString('ascii',8,12)!=='WEBP')) throw Error('Cabeçalho WebP inválido: '+relative);
  if(ext==='pdf' && buf.toString('ascii',0,5)!=='%PDF-') throw Error('PDF inválido: '+relative);
  if(ext==='svg' && /<script\b|\bon\w+\s*=|javascript\s*:/i.test(buf.toString('utf8'))) throw Error('SVG inseguro: '+relative);
  if(ext==='json') {
    const obj=JSON.parse(buf.toString('utf8'));
    const txt=JSON.stringify(obj);
    if(/pay\.kiwify\.com\.br/i.test(txt)) throw Error('Checkout indevido em JSON público: '+relative);
    if(/"(?:private[_-]?key|client[_-]?secret|password|api[_-]?token)"\s*:/i.test(txt)) throw Error('Campo de segredo em JSON público: '+relative);
  }
  return true;
}

function validatePreviews(root) {
  const folder=path.join(root,'previews');
  const st=fs.lstatSync(folder);
  if(!st.isDirectory() || st.isSymbolicLink()) throw Error('previews/ não é pasta real');
  const names=fs.readdirSync(folder);
  if(names.length!==50) throw Error('previews/ deve conter só 50 PDFs de demonstração, contém '+names.length);
  for(let i=1;i<=50;i++) {
    const name='book-'+String(i).padStart(3,'0')+'.pdf';
    if(!names.includes(name))throw Error('Prévia faltante: '+name);
    validateFile(root,'previews/'+name);
  }
}

function candidateFromArg(arg) {
  if(typeof arg==='string') return arg;
  if(arg&&typeof arg==='object') {
    for(const k of ['publicDir','outputDir','stagingDir','directory','dir','root']) {
      if(typeof arg[k]==='string')return arg[k];
    }
  }
  return null;
}
function getScanRoot(args,scriptDir) {
  const a=args.map(candidateFromArg).find(Boolean);
  if(!a)return path.resolve(scriptDir,'..','public');
  const choices=[path.resolve(a),path.resolve(scriptDir,'..',a)];
  for(const candidate of choices){
    if(fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())return candidate;
  }
  throw Error('Diretório de validação não encontrado: '+a);
}

function validateOnlyApprovedAdditionalEntries(legacyAssert, scriptDir, args=[]) {
  if(typeof legacyAssert!=='function')throw TypeError('Verificador anterior inválido');
  try { return legacyAssert(); }
  catch(e) {
    const lines=String(e?.message??'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const files=[];let previews=false;
    if(!lines.length) throw e;
    for(const line of lines) {
      const fm=/^Arquivo n[aã]o autorizado:\s*(.+)$/i.exec(line);
      const dm=/^Diret[oó]rio n[aã]o permitido:\s*(.+)$/i.exec(line);
      if(fm){const name=normalize(fm[1]);if(!name||!allowedFile(name)) throw e;files.push(name);continue;}
      if(dm){const name=normalize(dm[1]);if(name!=='previews')throw e;previews=true;continue;}
      // Uma mensagem desconhecida nunca é tolerada.
      throw e;
    }
    const root=getScanRoot(args,scriptDir);
    for(const name of files)validateFile(root,name);
    if(previews)validatePreviews(root);
    // Inspecione toda a pasta assets para não tolerar arquivos desconhecidos
    // que tenham sido omitidos de uma mensagem de erro incompleta.
    const assets=path.join(root,'assets');
    if(fs.existsSync(assets)) {
      const st=fs.lstatSync(assets);
      if(!st.isDirectory()||st.isSymbolicLink())throw Error('assets/ inválida');
      for(const name of fs.readdirSync(assets)) {
        const rel='assets/'+name;
        if(isCover(rel))validateFile(root,rel);
      }
    }
    return undefined;
  }
}
module.exports={allowedFile,validateFile,validatePreviews,validateOnlyApprovedAdditionalEntries,getScanRoot};
