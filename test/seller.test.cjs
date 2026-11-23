const test=require('node:test');const assert=require('node:assert/strict');
const {sellerReadiness}=require('../src/seller.cjs');
test('publicação é bloqueada quando suporte e identificação estão incompletos',()=>{
 const issues=sellerReadiness({memberUrl:'https://dashboard.kiwify.com.br/courses',seller:{legalName:'Diego Luan Ferreira da Silva'}});
 assert.equal(issues.length,3);
 assert.ok(issues.some(x=>x.includes('E-mail de atendimento')));
});
test('dados preenchidos passam no teste sintático, sem simular validação jurídica',()=>{
 const issues=sellerReadiness({memberUrl:'https://dashboard.kiwify.com.br/courses',seller:{legalName:'Empresa Teste LTDA',supportEmail:'suporte@example.com',document:'00.000.000/0001-00',address:'Rua Exemplo, 100, Centro'}});
 assert.deepEqual(issues,[]);
});
