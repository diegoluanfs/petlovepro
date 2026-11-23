'use strict';
/** Validate independently the Kiwify product->offer->checkout mapping (private, NOT in Hosting). */
const {validCheckout,EXPECTED}=require('./catalog-core.cjs');
function auditOfficialOffers(products, release, snapshot) {
 const errors=[];
 const rows=snapshot?.products||[];
 if(rows.length!==60)errors.push(`Kiwify: expected 60 verified offers, got ${rows.length}`);
 const map=new Map(rows.map(x=>[x.id,x]));
 if(map.size!==rows.length)errors.push('Kiwify: duplicate catalog IDs in verified offers');
 const links=new Set(),offers=new Set(),kiwifyIds=new Set();
 for(const p of products){
  const o=map.get(p.id);
  if(!o){errors.push(`${p.id}: oferta verificada ausente`);continue;}
  const expected=EXPECTED[p.kind];
  if(o.kiwifyProductId!==p.kiwifyProductId)errors.push(`${p.title}: ID do produto Kiwify divergente`);
  if(o.priceCents!==expected||p.price!==expected)errors.push(`${p.title}: preço Kiwify divergente`);
  if(o.currency!=='BRL'||!o.active||o.softBan)errors.push(`${p.title}: oferta Kiwify indisponível`);
  if(!validCheckout(o.checkoutUrl))errors.push(`${p.title}: link de checkout inválido`);
  if(release.productCheckoutUrls?.[p.id]!==o.checkoutUrl||p.checkout!==o.checkoutUrl)errors.push(`${p.title}: checkout não corresponde ao link consultado na Kiwify`);
  if(release.productOfferIds?.[p.id]!==o.kiwifyOfferId||p.kiwifyOfferId!==o.kiwifyOfferId)errors.push(`${p.title}: ID da oferta não corresponde à Kiwify`);
  if(p.live!==true)errors.push(`${p.title}: não foi liberado no catálogo`);
  if(links.has(o.checkoutUrl))errors.push(`${p.title}: link repetido`);links.add(o.checkoutUrl);
  if(offers.has(o.kiwifyOfferId))errors.push(`${p.title}: oferta repetida`);offers.add(o.kiwifyOfferId);
  if(kiwifyIds.has(o.kiwifyProductId))errors.push(`${p.title}: produto Kiwify repetido`);kiwifyIds.add(o.kiwifyProductId);
 }
 for (const id of map.keys())if(!products.some(p=>p.id===id))errors.push(`Kiwify: oferta sem produto editorial ${id}`);
 if(products.length!==60||release.releaseOnly?.length!==60)errors.push('Publicação integral: exigidos 60 produtos liberados');
 return errors;
}
module.exports={auditOfficialOffers};
