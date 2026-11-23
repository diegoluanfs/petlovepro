# PetLovePro Firebase ↔ Kiwify v1.3.0

Patch incremental para o repositório `C:\Users\diego\Desktop\projetos\petlovepro`.

**Leia primeiro `LEIA-ME-PRIMEIRO.md`.**

- `functions-petlovepro/`: Functions isoladas (checkout validado, webhook assinado,
  conciliação de pedidos e biblioteca por usuário).
- `firebase.commerce.json`: codebase independente; **sem Hosting, sem Rules**.
- `scripts/sync-commerce-firestore.cjs`: auditoria e sincronização de 60 produtos.
- `scripts/patch-commerce-library.cjs`: insere “Minha biblioteca” com backup, idempotente.
- `tests/firebase-library.test.cjs`: testes de compras individuais, coleções, estorno e segurança.
- `testes-firebase.ps1`: revisão, patch do frontend e suíte completa, sem deploy.

**Não inclui e-books/PDFs, credenciais, Webhooks criados, nem dados do Firestore remoto.**
A aplicação original e as funções legadas são preservadas.
