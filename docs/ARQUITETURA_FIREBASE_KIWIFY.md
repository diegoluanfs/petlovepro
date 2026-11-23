# Fluxo comercial PetLovePro — v1.3.0

1. **Vitrine:** o usuário seleciona `book-001...book-050` ou `collection-01...collection-10`.
2. **Auth:** o frontend pede o login; o backend `commerceBeginCheckout` consulta a conta no Firebase Authentication, exige e-mail verificado e consulta `commercialProducts/{id}`.
3. **Checkout:** se a oferta e o preço são válidos, o backend registra `checkoutIntents/{uuid}` e devolve a URL oficial da Kiwify com `s1={uuid}`.
4. **Pagamento:** a Kiwify processa pagamento e acesso à área de membros, sem expor os PDFs no site.
5. **Webhook:** `kiwifyCommerceWebhookV2` exige assinatura válida, loja PetLovePro e produto mapeado. O processamento idempotente atualiza `commerceOrders/{order_id}`, `users/{uid}/orders/{order_id}` e `commerceWebhookEvents/{eventId}`.
6. **Espelho Firebase:** `refreshLibraryForUser` recalcula `commerceLibraries/{uid}` usando exclusivamente pedidos aprovados; um livro concede um título, uma coleção concede exatamente cinco. Pix pendente, reembolso e chargeback não dão direito.
7. **Minha conta:** `commerceGetAccount` reconcilia pedidos anteriores pelo e-mail verificado do Firebase Authentication, recalcula a biblioteca e retorna a lista de livros ao frontend.
8. **Entrega:** o botão acessa a biblioteca Kiwify; nenhuma Cloud Function cria links públicos para o PDF integral.

## Firestore

| Coleção | Conteúdo | Quem escreve |
|---|---|---|
| `commercialProducts/{catalogId}` | 60 ofertas privadas verificadas | Sincronizador administrativo |
| `checkoutIntents/{uuid}` | usuário/produto selecionado, preço e referência `s1` | Callable autenticada |
| `commerceWebhookEvents/{eventId}` | deduplicação de eventos assinados | Webhook autenticado |
| `commerceOrders/{orderId}` | histórico assinado, aprovado/pendente/reembolsado | Webhook autenticado |
| `users/{uid}/orders/{orderId}` | cópia do pedido para conta verificada | Servidor |
| `commerceLibraries/{uid}` | coleção de IDs de livros e origem dos direitos | Servidor |
| `commerceAnalyticsOutbox/{orderId}` | evento de compra idempotente consentido | Servidor |

A biblioteca Firestore é um **espelho informativo**, não uma concessão de permissões na Kiwify.
Os direitos Kiwify são controlados pelos grupos/turmas já configurados.

## Proteções

- Assinatura do corpo bruto HMAC-SHA1 comparada em tempo constante.
- Nenhuma escrita remota sem ação explícita de sincronização/deploy.
- Login Firebase autenticado e e-mail verificado no servidor, não em documento editável.
- Preço e destino de checkout nunca são aceitos do navegador.
- `commercialProducts` e `commerceOrders` devem permanecer inacessíveis para gravação direta do cliente.
- Pedidos reembolsados não voltam a aprovados por webhook fora de ordem.
- Dois pedidos válidos para o mesmo livro não criam duas entradas na biblioteca.
- `GA4_API_SECRET` e `KIWIFY_WEBHOOK_TOKEN` ficam somente no Secret Manager.

## Limitações operacionais

- Login Firebase e acesso ao portal Kiwify continuam sendo logins distintos; o e-mail deve ser o mesmo para conciliação automática.
- Se um comprador trocar o e-mail na Kiwify, o pedido poderá não se associar à conta Firebase original e exigirá suporte.
- PDFs/cursos na Kiwify não foram retestados integralmente nesta entrega; conferência real é obrigatória.
- O código pressupõe o formato de webhook `webhook_event_type`, `Product.product_id`, `Customer.email`, `Commissions.charge_amount` e `TrackingParameters.s1`. Verifique o payload real de um evento assinado.
