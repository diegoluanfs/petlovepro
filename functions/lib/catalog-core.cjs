'use strict';
const fs = require('node:fs');
const path = require('node:path');
const EXPECTED = {book:2490,collection:7990};
const COLLECTION_KIWIFY = [
  'Nutrição Natural para Pets','Petiscos e Alimentação Complementar',
  'Comportamento e Conexão','Educação e Adestramento',
  'Atividade Física e Enriquecimento','Higiene e Cuidados Diários',
  'Fases da Vida e Adoção','Convivência e Estilo de Vida',
  'Saúde e Prevenção','Guias Essenciais do Tutor'
];
const normalize = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const readJSON = file => JSON.parse(fs.readFileSync(file,'utf8'));
function readKiwifyTSV(file) {
  const rows=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(line=>{
    const [title,productId,priceStr]=line.split('|');
    if(!title||!productId||!/^\d+$/.test(priceStr||'')) throw Error('Linha TSV inválida: '+line);
    return {title,productId,priceCents:Number(priceStr),active:true,currency:'BRL'};
  });
  return rows;
}
function compile(editorial,verified,releases,previous=[]) {
  const issues=[];
  const byName=new Map();
  for(const k of verified) {
    const normalized=normalize(k.title);
    if(byName.has(normalized)) issues.push(`Kiwify: nome duplicado: ${k.title}`);
    byName.set(normalized,k);
  }
  const products=[];
  const used=new Set();
  for(const b of editorial.books||[]) {
    const match=byName.get(normalize(b.title));
    if(!match) {issues.push(`Livro ${b.id} — ${b.title}: produto comercial não localizado`);continue;}
    used.add(match.productId);
    products.push(present(b,match,releases,'book',issues));
  }
  for(let i=0;i<(editorial.collections||[]).length;i++) {
    const c=editorial.collections[i];
    const commercialName=COLLECTION_KIWIFY[i];
    const match=byName.get(normalize(commercialName));
    if(!match){issues.push(`Coleção ${c.id} — ${c.title}: produto ${commercialName} não localizado`);continue;}
    used.add(match.productId);
    const p=present(c,match,releases,'collection',issues);
    p.volumeIds=[...c.volumes];
    if(p.volumeIds.length!==5||new Set(p.volumeIds).size!==5)
      issues.push(`${c.title}: composição precisa conter cinco livros distintos`);
    for(const vid of p.volumeIds) if(!editorial.books.some(x=>x.id===vid))
      issues.push(`${c.title}: livro inexistente ${vid}`);
    products.push(p);
  }
  if((editorial.books||[]).length!==50) issues.push(`Esperados 50 livros; encontrados ${editorial.books?.length||0}`);
  if((editorial.collections||[]).length!==10) issues.push(`Esperadas 10 coleções; encontradas ${editorial.collections?.length||0}`);
  if(products.length!==60) issues.push(`Esperados 60 produtos associados; encontrados ${products.length}`);
  if(verified.length!==60) issues.push(`Kiwify: esperados 60 produtos; encontrados ${verified.length}`);
  for(const v of verified) if(!used.has(v.productId)) issues.push(`Produto Kiwify sem item de catálogo: ${v.title}`);
  const identifiers=new Set();
  for(const p of products) {
    if(identifiers.has(p.id))issues.push(`ID duplicado: ${p.id}`);
    identifiers.add(p.id);
  }
  for(const p of previous) {
    const now=products.find(x=>x.id===p.id);
    if(p.live===true && now?.live!==true && !(releases.explicitRollbacks||[]).includes(p.id))
      issues.push(`${p.title||p.id}: REGRESSÃO — produto já publicado voltaria para Em breve`);
  }
  return {issues,products,ok:issues.length===0};
}
function present(item,match,releases,kind,issues) {
  const id=item.id;
  const expected=EXPECTED[kind];
  if(match.priceCents!==expected)issues.push(`${item.title}: preço Kiwify ${match.priceCents} difere de ${expected}`);
  if(match.currency!=='BRL')issues.push(`${item.title}: moeda Kiwify inválida`);
  const requested=(releases.releaseOnly||[]).includes(id);
  const checkout=releases.productCheckoutUrls?.[id]||'';
  const validURL=validCheckout(checkout);
  if(requested&&!releases.productOfferIds?.[id])issues.push(`${item.title}: falta ID da oferta Kiwify`);
  if(requested&&!validURL)issues.push(`${item.title}: liberação solicitada sem URL de checkout Kiwify validada`);
  if(requested&&!match.active)issues.push(`${item.title}: oferta indisponível`);
  const live=requested&&validURL&&match.active&&match.priceCents===expected&&match.currency==='BRL';
  return {id,title:item.title,kind,live,price:live?expected:null,checkout:live?checkout:'',
    currency:'BRL',kiwifyProductId:match.productId,kiwifyOfferId:live?(releases.productOfferIds?.[id]||null):null,offerVerified:live,offerActive:live,offerPriceCents:live?expected:null,
    memberUrl:releases.memberUrl||null,cover:item.cover||item.original_cover||null,
    collectionId:item.collection_id||null};
}
function validCheckout(url){try {const u=new URL(url);return u.protocol==='https:'&&u.hostname==='pay.kiwify.com.br'&&/^\/[A-Za-z0-9]+$/.test(u.pathname)&&!u.username&&!u.password;}catch{return false;}}
function auditPrivateRecords(records) {
  const errors=[];
  for(const p of records) {
    if(!['book','collection'].includes(p.kind))errors.push(`${p.id}: tipo inválido`);
    if(p.live) {
      if(!validCheckout(p.checkout))errors.push(`${p.title}: checkout inválido`);
      if(p.price!==EXPECTED[p.kind])errors.push(`${p.title}: preço divergente`);
    }else if(p.price!==null||p.checkout)errors.push(`${p.title}: indisponível não deve expor preço/checkout`);
  }
  return errors;
}
module.exports={readJSON,readKiwifyTSV,compile,normalize,validCheckout,auditPrivateRecords,EXPECTED,COLLECTION_KIWIFY};
