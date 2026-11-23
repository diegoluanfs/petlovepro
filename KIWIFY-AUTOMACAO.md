# PetLovePro — automação comercial inicial (v0.4.4)

Extrair os três arquivos na raiz do projeto. Nenhuma alteração no frontend, nas Cloud Functions ou no pipeline de deploy. Node 22+ e dependências de functions instaladas. O script usa o catálogo existente, não inclui os arquivos editoriais e não envia PDFs para lugar algum.

## 1. Manifesto privado

```powershell
node scripts/kiwify-sync.cjs manifest
npm test
```

Gera `private/kiwify-manifest.local.json` com 50 e-books, 10 coleções, nomes, descrições comerciais propostas, preços sugeridos, caminhos locais e composição. Revise os preços e descrições antes de criar produtos. A primeira coleção preserva o identificador interno `nutricao-natural`. Não inclua o arquivo no Git.

## 2. Cadastro na Kiwify

Documentação oficial: https://ajuda.kiwify.com.br/pt-br/article/como-conectar-a-kiwify-a-um-agente-de-ia-kq2kxy/

O conector oficial MCP usa `https://mcp.kiwify.com/mcp` e OAuth. Se o ChatGPT oferecer a opção de servidor MCP personalizado, conecte e conceda somente leitura/criação/edição de produtos e estrutura de área de membros; não conceda exclusão, cancelamento, financeiro ou afiliados. Envie apenas o manifesto, não as credenciais. Solicite primeiro inventário e plano; confirme um piloto de produto antes de executar em lotes. Não duplique o produto 001 já criado. Os nomes precisam corresponder aos títulos no catálogo, sem prefixos adicionais. Não houve verificação de upload de anexos pelo MCP: envie os PDFs e bônus pela área privada da Kiwify, revise grupos de acesso e DRM e teste a entrega.

A API REST pública documenta consulta de produtos, não criação: https://docs.kiwify.com.br/api-reference/general . Portanto este script local não cria produtos na Kiwify.

## 3. Consulta em lote por API (somente leitura)

No painel Kiwify, Apps > API > Criar API Key. Permissão de produtos (`products`). Copie Client ID, Client Secret e Account ID. No PowerShell (sem colocar valores no histórico):

```powershell
$env:KIWIFY_ACCOUNT_ID = Read-Host 'Account ID Kiwify'
$env:KIWIFY_CLIENT_ID = Read-Host 'Client ID Kiwify'
$secret = Read-Host 'Client Secret Kiwify' -AsSecureString
$env:KIWIFY_CLIENT_SECRET = [System.Net.NetworkCredential]::new('', $secret).Password
try { node scripts/kiwify-sync.cjs sync } finally { Remove-Item Env:KIWIFY_CLIENT_SECRET,Env:KIWIFY_CLIENT_ID,Env:KIWIFY_ACCOUNT_ID -ErrorAction SilentlyContinue; Remove-Variable secret -ErrorAction SilentlyContinue }
```

Consulta lista paginada e detalhes. Usa ID já informado (com título conferido) ou título exato normalizado. Valida produto ativo, BRL, pagamento único, entrega membership, preço em centavos e link ativo de checkout único sem ofertas adicionais. Ofertas múltiplas ou respostas que não correspondam ao contrato documentado exigem revisão. Não inventa IDs, links ou preços. Não habilita checkout novo; recusa execução se há vendas habilitadas no plano. Preserva backup do JSON anterior em `private/kiwify-products.backup.local.json` e gera relatório `private/kiwify-sync-report.local.json`. Consultas não gravam na Kiwify nem no Firestore. Caso haja produtos não encontrados, crie/revise-os antes de repetir. Para configurar só o primeiro produto manualmente, também é possível usar o JSON existente já preenchido e validado com checkout desativado e `enabled` global false.

## 4. Firestore: prévia e aplicação explícita

Use ADC via Google Cloud CLI: https://docs.cloud.google.com/sdk/docs/install . A conta precisa de permissões IAM de leitura/gravação no Firestore do projeto. O login do Firebase CLI por si só não é suficiente.

```powershell
npm --prefix functions install
gcloud auth application-default login
gcloud auth application-default set-quota-project petlovepro-ae222
npm run commerce:catalog
node scripts/kiwify-sync.cjs firestore
```

A prévia consulta banco, detecta conflitos e não grava. Confirme os produtos no JSON e no relatório antes da operação:

```powershell
node scripts/kiwify-sync.cjs firestore --apply --confirm=petlovepro-ae222
```

Transação em `commerce/kiwify` e `kiwifyProducts/{id}` apenas para registros mapeados/habilitados no plano. Não cria pedidos, não exclui documentos, não modifica clientes e recusa loja ou checkout existente ativo. Mesmo após a gravação, a loja global e o checkout estão desativados. A liberação será uma etapa posterior após revisão de entrega e testes reais; atualizar o catálogo público e o Firestore de forma coordenada será necessário nessa etapa. Não adicione o plano privado ao Git.

## 5. Diagnóstico do webhook sem pagamento

```powershell
$secret = Read-Host 'Token do webhook da Kiwify (o mesmo do Firebase)' -AsSecureString
$env:KIWIFY_WEBHOOK_TOKEN = [System.Net.NetworkCredential]::new('', $secret).Password
try { node scripts/kiwify-sync.cjs probe } finally { Remove-Item Env:KIWIFY_WEBHOOK_TOKEN -ErrorAction SilentlyContinue; Remove-Variable secret -ErrorAction SilentlyContinue }
```

Envia um tipo de evento desconhecido ao receptor já implantado: HMAC inválido deve receber 401; HMAC válido deve receber 200 e `Ignored event`. Não grava pedidos. Isto valida conectividade e token, não autentica um envio real do provedor nem valida compra/entrega. Na Kiwify, Apps > Webhooks > Testar Webhook gera IDs fictícios; 422 `Unmapped product` indica que o backend aceitou a assinatura e o payload, mas não encontrou o produto. Confira Ver logs e, se necessário, `firebase functions:log --only kiwifyWebhook --project petlovepro-ae222`. Não envie tokens, assinaturas, CPF ou dados pessoais nos logs compartilhados.

## 6. Versionamento

```powershell
git add scripts/kiwify-sync.cjs test/kiwify-sync.test.cjs KIWIFY-AUTOMACAO.md
git diff --cached --name-only
git commit -m "feat: automate Kiwify catalog synchronization and webhook diagnostics"
git push origin main
```

Não versionar `private/`, `coleções/`, credenciais, ou arquivos do Wrangler. Os novos testes usam serviços simulados; não houve operação em produção neste ambiente.
