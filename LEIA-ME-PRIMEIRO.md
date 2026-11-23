# PetLovePro v1.3.0 — Firebase + Kiwify (integração de vendas)

**Destino**: `C:\Users\diego\Desktop\projetos\petlovepro`

Este pacote é um **incremento**, não um projeto substituto. Ele adiciona/atualiza somente
`functions-petlovepro/`, `firebase.commerce.json`, dois scripts de `scripts/`,
`tests/firebase-library.test.cjs` e `testes-firebase.ps1`.

Não altera `functions/` (legada), `firebase.json`, `.firebaserc`, `firestore.rules`,
`public/`, `coleções/`, `private/`, preços, grupos Kiwify ou PDFs.

## 1 — Cópia de segurança (faça ANTES de extrair)

```powershell
cd C:\Users\diego\Desktop\projetos\petlovepro
git status
# Se você já customizou functions-petlovepro, preserve uma cópia antes de sobrescrever.
```

## 2 — Extrair e testar SEM escrever em produção

```powershell
cd C:\Users\diego\Desktop\projetos\petlovepro
Expand-Archive -Path "$HOME\Downloads\PetLovePro_Firebase_Kiwify_v1.3.0.zip" -DestinationPath (Get-Location).Path -Force
powershell -NoProfile -ExecutionPolicy Bypass -File .\testes-firebase.ps1
npm --prefix functions-petlovepro install
```

O script usa `node`, corrige o frontend **somente se encontrar os marcadores conhecidos**, faz backup da página
em `.petlovepro-backups/`, verifica o catálogo local e executa o `npm run verify`.
**NENHUM deploy ou escrita remota é efetuado.**

## 3 — Comparar Firestore (SOMENTE LEITURA)

O script de sincronização Firebase Admin precisa de *Application Default Credentials*.
Instale o Google Cloud CLI (`gcloud`) e autentique-se com uma conta que tenha acesso ao projeto:

```powershell
gcloud auth application-default login
node .\scripts\sync-commerce-firestore.cjs --remote --project=petlovepro-ae222
```

Se for usar uma conta de serviço, guarde sua chave fora do repositório, proteja-a e
use `$env:GOOGLE_APPLICATION_CREDENTIALS` apenas na sua sessão.

## 4 — Sincronização REAL (somente com aprovação comercial)

A operação abaixo pode habilitar os 60 produtos no Firestore. Antes, confira a comparação remota e
os 60 links, preços e permissões da Kiwify.

```powershell
$env:PLP_CONFIRM_FIRESTORE_SYNC='petlovepro-ae222'
node .\scripts\sync-commerce-firestore.cjs --apply --project=petlovepro-ae222
Remove-Item Env:\PLP_CONFIRM_FIRESTORE_SYNC
```

A operação NÃO modifica usuários, pedidos, direitos de acesso da Kiwify ou regras Firestore.
Ela grava com `merge: true` e bloqueia conflitos de ID, preço, oferta, URL, moeda ou composição de coleção.

## 5 — Publicar APENAS o novo codebase de Functions

Configure primeiro os segredos; não coloque tokens em `.env`, Git ou no chat.

```powershell
firebase login
firebase projects:list
# Confirme que não há Functions já publicadas com os mesmos nomes:
firebase functions:list --project petlovepro-ae222
firebase functions:secrets:set KIWIFY_WEBHOOK_TOKEN --project petlovepro-ae222
firebase functions:secrets:set GA4_API_SECRET --project petlovepro-ae222
npm --prefix functions-petlovepro install
firebase deploy --only functions:petlovepro-commerce --config firebase.commerce.json --project petlovepro-ae222
```

- `KIWIFY_WEBHOOK_TOKEN`: crie um token aleatório de ao menos 32 caracteres e configure o MESMO token no painel de webhooks da Kiwify.
- `GA4_API_SECRET`: segredo criado no GA4 em Fluxos de dados → Measurement Protocol → Segredos da API. **Não é** o `measurementId`.
- O codebase `petlovepro-commerce` é isolado das Functions legadas (`functions/`), porém **nomes de funções publicados no mesmo projeto/região não podem colidir**. Se `commerceBeginCheckout`, `commerceGetAccount`, `commerceGA4Purchase` ou `kiwifyCommerceWebhookV2` já existirem, audite antes do deploy.
- Não executar `firebase deploy` sem `--only` nem publicar `firebase.petlovepro.json`.

## 6 — Configurar o webhook na Kiwify

Em **Apps → Webhooks → Criar webhook**, configure todos os produtos relevantes (50 livros + 10 coleções)
e os eventos de compra aprovada, Pix gerado, boleto gerado, reembolso e chargeback/cancelamento (quando disponíveis).

Endpoint esperado após a publicação:

`https://us-central1-petlovepro-ae222.cloudfunctions.net/kiwifyCommerceWebhookV2`

A assinatura é validada via HMAC-SHA1 do corpo original. A Kiwify deve enviar um parâmetro de query
`signature` calculado com o token. **Não** copie o segredo na URL. Teste na Kiwify e verifique o retorno 2xx.

## 7 — Homologação (obrigatória)

1. Com um usuário Firebase de e-mail verificado, inicie a compra de um único livro de teste.
2. Em `commerceOrders`, confirme status `pending` apenas para Pix pendente e `approved` somente após pagamento real.
3. Em `commerceLibraries/{uid}`, confirme que a compra individual liberou somente o livro adquirido.
4. Com uma coleção de teste, verifique exatamente cinco livros no espelho.
5. Repita o webhook: não devem surgir duas compras nem duplicação de direitos.
6. Reembolse em um cenário controlado; a biblioteca deve ser recalculada sem remover direitos de outro pedido válido.
7. Na Kiwify, confirme curso e PDF da aula em Anexos com a conta compradora.

**Importante:** este pacote implementa o código e os testes, mas não publica Functions, não cria webhooks
remotamente e não confirma pagamentos reais. A execução de homologação depende dos acessos do titular.

Veja `docs/ARQUITETURA_FIREBASE_KIWIFY.md` e `docs/REGRAS_E_HOMOLOGACAO.md`.
