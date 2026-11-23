# Relatório de entrega — PetLovePro v1.0.0

**Data:** 20/11/2026  
**Escopo:** Aplicação completa de vitrine e fluxo comercial P0.1–P0.6 / P1.7–P1.8 para integração com Firebase + Kiwify.

## Implementado no código

- Vitrine responsiva em PT-BR, rotas de início, 50 e-books, 10 coleções, livros, login, conta, ajuda, termos e privacidade.
- Paleta PetLovePro, 60 imagens originais, 50 PDFs de demonstração gratuitos.
- Catálogo público `catalog.js` / `catalog-commerce.json` com Livro 001 em R$24,90, demais 59 em breve.
- Backend Firebase Callable de checkout e conta, autenticação e e-mail verificado.
- Intenção de compra persistida no cliente e no Firestore; parâmetro Kiwify `s1` na URL do checkout para reconciliação.
- Webhook HMAC-SHA1 sobre corpo cru, validação da loja, transações Firestore, estados aprovado, pendente, reembolso, duplicação.
- Links oficiais da biblioteca e orientações de Anexos nos pedidos aprovados.
- Consentimento GA4, eventos `view_item`, `begin_checkout`, `purchase` por outbox.
- Auditoria de produtos/valores, de regressões e das 10 composições de coleções.
- Arquivos pagos mantidos em `private-delivery/`, excluídos do build público.

## Testes efetivamente executados

- **36 de 36 testes automatizados aprovados** (`npm run verify`).
- Build estático gerado: 60 produtos, 60 capas, 50 PDFs de demonstração; somente Livro 001 liberado.
- Firestore: apenas simulação/dry-run; nenhuma gravação remota.
- HTTP smoke test local: `/`, `/style.css`, `/app.js`, `/catalog-commerce.json`, `/assets/book-001.webp`, `/previews/book-001.pdf`, `/seller-public.json` retornaram 200; arquivo de plano privado retornou 404.
- Inspeção por conector Kiwify: Livro 001 / R$24,90, oferta e link ativos; módulo, aula publicada, liberação imediata, PDF anexado; turma Livro 001 e Coleção 01 autorizadas.
- Inspeção por conector Kiwify: 50 produtos individuais R$24,90 e 10 coleções R$79,90; cada turma de coleção autoriza cinco cursos.

## Não realizados / impedimentos de produção

- Não houve clone/merge/push no repositório original (acesso ao código original indisponível).
- Não foi realizado deploy de Hosting/Functions nem leitura ou gravação em Firestore real (sem credenciais).
- Não houve compra real nem validação de Pix/GA4 em contas reais.
- Falta confirmação de suporte, identificação fiscal/endereço, revisão jurídica dos textos e configuração Firebase Web.
- Um teste de screenshot automatizado com Chromium falhou por bloqueio de navegação do ambiente. Recomenda-se smoke test visual em Chrome/Edge e mobile antes do deploy.
- Materiais editoriais pagos são preliminares e dependem de validação profissional apropriada. Não divulgar como revisão veterinária concluída.

**Conclusão técnica:** código da aplicação e integrações entregue, testado localmente. **Não está homologado nem publicado em produção**. `npm run release:check` impede a divulgação antes de corrigir as pendências reais.
