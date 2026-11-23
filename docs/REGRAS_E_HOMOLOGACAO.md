# Firestore rules e homologação

**NÃO publique novas regras sem revisar as regras existentes da sua aplicação.**
A integração usa Admin SDK e Callables, portanto o navegador NÃO precisa gravar ou ler diretamente:

- `commercialProducts`
- `checkoutIntents`
- `commerceOrders`
- `commerceWebhookEvents`
- `commerceAnalyticsOutbox`
- `commerceLibraries`

Os registros contêm e-mails e dados comerciais privados. Se as regras atuais tiverem permissões amplas
por wildcard ou em uma seção `allow write`, revise-as antes do deploy. Regras Firestore aplicam condições
por OR entre matches aplicáveis; adicionar um `allow false` não neutraliza um `allow true` amplo.

Não mexer em `functions/`, `firebase.json`, `firestore.rules` nem nas regras da área de membros Kiwify
sem auditoria do ambiente real. `firebase.commerce.json` é um arquivo isolado contendo apenas Functions.

## Checklist

- [ ] `npm run verify` aprova no repositório real.
- [ ] `scripts/sync-commerce-firestore.cjs --remote` não encontra conflitos.
- [ ] 60 documentos em `commercialProducts` têm preços corretos.
- [ ] O projeto ativo no Firebase é `petlovepro-ae222`.
- [ ] Conta Firebase com e-mail confirmado.
- [ ] Segredos configurados sem exposição e webhook assinado recebido com HTTP 200.
- [ ] Livro individual comprado: um único ID na biblioteca; PDF visível somente na Kiwify.
- [ ] Coleção comprada: exatamente os cinco livros adquiridos.
- [ ] Pix não pago: não gera biblioteca.
- [ ] Reembolso e chargeback: direito removido, preservando livros pagos por outros pedidos.
- [ ] Evento duplicado: um pedido e uma conversão (se GA4 habilitado e consentimento válido).
- [ ] Regras de produção impedem alteração de pedidos e biblioteca pelo navegador.
- [ ] Checkout e área de membros testados em navegador real com conta compradora.
- [ ] Dados de suporte e documentos legais aprovados antes de campanha/lançamento.
