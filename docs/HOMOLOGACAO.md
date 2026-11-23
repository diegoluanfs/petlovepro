# Checklist de homologação — 60 produtos PetLovePro v1.2.0

## Pré-requisitos e segurança
- [ ] Conferir a identidade do vendedor, contato real e documentação legal e aprovar `data/legal-approval.json` somente depois de efetiva conferência.
- [ ] Conferir estado do Firebase real, Functions existentes, Webhook Kiwify e regras Firestore antes de qualquer escrita.
- [ ] Auditar o mapa `docs/MAPA_COMPLETO_60_OFERTAS_KIWIFY.md` (snapshot Kiwify 23/11/2026).
- [ ] Confirmar a disponibilização do PDF correto em cada uma das 50 aulas autorizadas; não basta a aula constar como publicada.

## Catálogo e navegação
- [ ] 50 cards e detalhes de livro, cada um a **R$ 24,90** com CTA **Comprar na Kiwify**.
- [ ] 10 cards e detalhes de coleção, cada uma a **R$ 79,90** com CTA **Comprar coleção**.
- [ ] Conferir os 60 IDs internos, 60 IDs Kiwify, 60 ofertas e 60 links de checkout.
- [ ] Conferir 10 coleções com cinco títulos distintos e suas respectivas turmas com somente cinco cursos.
- [ ] Ler amostras grátis sem expor nenhum PDF integral no Hosting.
- [ ] Verificar busca, filtros, menus, responsividade desktop/mobile e acessibilidade dos botões.

## Firestore e compra
- [ ] Conferir plano `dist/firestore-commerce-plan.private.json` e sincronizar 60 documentos `commercialProducts` somente após autenticar o administrador.
- [ ] Usar conta verificada para testar um e-book; confirmar link da Kiwify, ID do produto, valor e moeda.
- [ ] Usar conta verificada para testar uma coleção; confirmar preço R$ 79,90 e os cinco cursos corretos.
- [ ] Deslogado: selecionar Livro 042, fazer login, confirmar email e voltar a **Continuar compra** do Livro 042.
- [ ] Forçar divergência de preço/oferta indisponível em **ambiente de teste** e confirmar bloqueio de checkout.
- [ ] Pix pendente → aguardando pagamento; pago → compra aprovada; reembolso → mesmo pedido atualizado.
- [ ] Duplicar webhook válido e verificar um único pedido/conversão; webhook inválido retorna erro e não grava dados.
- [ ] Conferir minha conta → minhas compras → link da biblioteca e PDF em **Anexos**.

## GA4, deploy e pós-publicação
- [ ] Com consentimento medir view_item, begin_checkout e purchase, em BRL e com item_id correto.
- [ ] Evitar duplicidade com tracking nativo da Kiwify e confirmar transaction_id único.
- [ ] Validar Hosting em canal de preview e inspecionar desktop/mobile com navegador real.
- [ ] Confirmar `npm run release:check` com dados públicos realmente aprovados.
- [ ] Só então publicar alterações no projeto petlovepro-ae222 e monitorar erros de checkout e webhook.

**Não considerar marcações de testes locais como confirmação de pagamento real ou liberação comercial.**
