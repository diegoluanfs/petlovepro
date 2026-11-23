'use strict';
function sellerReadiness(policy){
 const issues=[];const s=policy.seller||{};
 if(!s.legalName||s.legalName.toLowerCase().includes('configurar'))issues.push('Nome do responsável não configurado');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.supportEmail||''))issues.push('E-mail de atendimento real não foi confirmado');
 if(!s.document)issues.push('Documento/identificação do vendedor não informado');
 if(!s.address)issues.push('Endereço comercial/de atendimento não informado');
 if(!/^https:\/\//.test(policy.memberUrl||''))issues.push('Endereço oficial da biblioteca não definido');
 return issues;
}
module.exports={sellerReadiness};
