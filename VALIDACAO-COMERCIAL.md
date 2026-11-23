# Validação comercial pré-lançamento

Extrair na raiz do projeto. Requer as credenciais ADC já configuradas e `npm --prefix functions install` já executado.

```powershell
node --test test/commerce-readiness.test.cjs test/webhook.test.cjs test/callable.test.cjs test/logic.test.cjs
node scripts/commerce-readiness.cjs
```

O segundo comando lê o plano privado, catálogo público e os documentos `commerce/kiwify` e `kiwifyProducts` em produção. Transação somente leitura, sem alterações em pedidos, clientes, flags ou produtos. Esperado: `ok: true`, `checked: 60`, `valid: 60`, `issues: []`. Os campos legais e de suporte vazios são reportados separadamente para revisão. A lista de documentos deve conter somente os 60 produtos desta loja; entradas extras exigem análise, nunca exclusão automática. Não enviar credenciais, URLs de checkout ou dados de clientes.

Os testes locais empregam dados sintéticos e não provam a entrega automática pela Kiwify. Para validar a origem do webhook, abrir Apps > Webhooks > Testar Webhook e conferir status e corpo da resposta no log. O teste do provedor pode usar dados fictícios; se usar um ID de produto não mapeado, HTTP 422 é esperado. Se persistir pedido fictício, identificar precisamente o ID antes de qualquer limpeza. Não reenviar eventos de vendas reais para simular. Não compartilhar assinatura, token, CPF ou e-mail de comprador.

Não habilitar vendas nesta etapa. Conferir acesso como aluno com conta de teste, compra individual e coleção por um método oficialmente admitido pela Kiwify, reembolso/revogação e revisão editorial/legal antes de publicar checkouts. Nenhuma cobrança ou matrícula é executada por este pacote.
