# PetLovePro — Integracao comercial v1.4.0

**Status:** codigo e testes locais prontos. **Nao** e uma confirmacao de webhook Kiwify ativo ou compra real. **Nenhum deploy e executado por este pacote.**

Este ZIP **incremental** vai diretamente na raiz do repositorio `petlovepro`. Preserva os 50 PDFs pagos, as dez colecoes, as 60 ofertas e os arquivos `functions/`, `.git`, `firebase.json`, `firestore.rules`, `data/` e `public/` existentes.

## O que mudou

- Reprocessamento confiavel do outbox GA4 quando a invocacao trava em `sending`, com lease de 2 minutos, limites de 8 tentativas e estados `sent`, `skipped`, `failed`.
- `commerceGA4Purchase` na regiao `southamerica-east1`, conforme o deploy ja concluido.
- Ao receber um webhook Kiwify repetido, o backend devolve o UID e pode atualizar a biblioteca que ficou pendente por uma falha apos o commit.
- Bloqueio de associacao de um pedido a dois UIDs e validacao de IDs antes de montar caminhos no Firestore.
- Eventos assinados invalidos recebem HTTP 422 (revisao); indisponibilidade de infraestrutura recebe HTTP 500 (retentativa). Formato JSON invalido recebe 400.
- Sondas HTTPS sem compra: GET 405, POST nao assinado 401, e uma sonda assinada opcional com tipo de evento ignorado (HTTP 200).
- Preflight do site publicado: arquivos do frontend, catalogo 60 ofertas, Firebase, GA4 e dados legais.
- Painel CLI **somente leitura** de status do Firestore, com contagens agregadas e sem imprimir e-mails, UIDs ou tokens.

## Como instalar

Abra PowerShell na raiz. **Antes**, crie um commit local ou backup dos arquivos existentes. Para salvar um backup dos arquivos afetados com PowerShell:

```powershell
cd C:\Users\diego\Desktop\projetos\petlovepro
$backup = "$HOME\Desktop\PetLovePro-antes-v140-$(Get-Date -Format yyyyMMdd-HHmmss).zip"
Compress-Archive -Path .\functions-petlovepro,.\scripts,.\src,.\tests -DestinationPath $backup
```

Em seguida, extraia o ZIP de atualizacao e teste:

```powershell
Expand-Archive -Path "$HOME\Downloads\PetLovePro_Fechamento_Comercial_v1.4.0.zip" -DestinationPath (Get-Location).Path -Force
powershell -NoProfile -ExecutionPolicy Bypass -File .\VALIDAR-INTEGRACAO-140.ps1
```

O pacote nao substitui `package.json` nem o seu `package-lock.json`. Nao execute `npm ci` na raiz se nao houver `package-lock.json`; o teste nao depende dele.

## Implantacao (somente apos testes locais aprovados)

Ja existem sete Functions na producao. Para atualizar **apenas o codebase comercial**, sem alterar as tres Functions legadas:

```powershell
firebase deploy --only functions:petlovepro-commerce --config firebase.commerce.json --project petlovepro-ae222
firebase functions:list --project petlovepro-ae222
```

Devera manter: `registered`, `syncProfile`, `kiwifyWebhook`, `commerceBeginCheckout`, `commerceGetAccount`, `kiwifyCommerceWebhookV2` e `commerceGA4Purchase`. A ultima fica em `southamerica-east1`, as outras comerciais em `us-central1`.

**Nao e necessario** repetir `scripts/sync-commerce-firestore.cjs --apply`: 60 registros ja foram criados na execucao anterior. Para conferir sem gravar:

```powershell
node .\scripts\sync-commerce-firestore.cjs --remote --project=petlovepro-ae222
node .\scripts\audit-commerce-status.cjs --project=petlovepro-ae222
```

## Webhook Kiwify: configuracao manual obrigatoria

A integracao Kiwify conectada ao ChatGPT nao possui acoes para criar/listar webhooks. Configure no painel **Apps > Webhooks**. Antes de criar outro, verifique se ja existe um webhook apontando para `kiwifyWebhook` antigo; nao desative sem auditar seu comportamento.

**Novo endpoint:** `https://us-central1-petlovepro-ae222.cloudfunctions.net/kiwifyCommerceWebhookV2`

**Token:** exatamente o mesmo conteudo de `KIWIFY_WEBHOOK_TOKEN` no Secret Manager. Nao inclua a chave em arquivos, logs, chat ou Git.

**Produtos:** os 50 livros e as dez colecoes, sem liberar turmas diferentes das compradas.

**Eventos para produtos de pagamento unico:** compra aprovada (`order_approved`), Pix gerado (`pix_created`), boleto gerado (`billet_created`), reembolso (`order_refunded`), chargeback (`order_chargeback`/`chargeback`) e cancelamento/recusa se disponiveis.

A Kiwify entrega um corpo JSON assinado com HMAC-SHA1 na query `signature`. O codigo exige assinatura, `store_id=zqlEDKV4S2QSt38`, identificador de produto mapeado e um evento reconhecido. **Um botao de teste que envie um pedido ficticio com produto desconhecido devera receber 422; isso e deliberado para evitar acessos ficticios.**

## Testes sem transacao

```powershell
node .\scripts\probe-commerce-webhook.cjs
node .\scripts\preflight-commerce.cjs --base=https://petlovepro.com.br
```

O primeiro deve retornar GET 405 e POST sem assinatura 401. O segundo auditara o HTML e o catalogo efetivamente publicados. **Se o site ainda estiver com a versao antiga ou faltarem dados legais, o preflight falhara: corrija a implantacao e a ficha do vendedor, nao remova a verificacao.**

Para validar um token ja configurado, voce pode fazer um teste *assinado e sem pedido*. Na mesma janela PowerShell:

```powershell
$seguro = Read-Host 'Token Kiwify do webhook' -AsSecureString
$cred = New-Object System.Net.NetworkCredential('', $seguro)
$env:KIWIFY_WEBHOOK_TOKEN = $cred.Password
try { node .\scripts\probe-commerce-webhook.cjs --signed }
finally { Remove-Item Env:\KIWIFY_WEBHOOK_TOKEN -ErrorAction SilentlyContinue; $cred = $null; $seguro = $null }
```

O corpo tem somente `webhook_event_type='plp_diagnostic'` e `store_id`, sem dados de pagamento. O endpoint devera responder 200 `ignored`. **Nao use um `order_approved` ficticio contra a producao.**

## Website e GA4

- No site publicado, `commerceBeginCheckout` deve responder ao navegador **apos login e e-mail verificado**.
- O site deve usar `G-K2CLX0L79J` e apenas carregar a tag GA4 **apos aceitar metricas** no banner de consentimento.
- No Google Analytics, teste Realtime/DebugView com uma visita consentida. A advertencia "nenhum dado foi recebido" nao e resolvida apenas com a publicacao do backend.
- Verifique se o seu pipeline Cloudflare esta publicando o diretorio atualizado `site-dist/`. Nao publique a raiz do projeto, PDFs integrais ou `dist/firestore-commerce-plan.private.json`.
- O preflight exige contato de suporte e nome comercial preenchidos. **Nao invente dados juridicos.**

## Homologacao de um pagamento real

1. Abra o site publicado em sessao limpa; aceite metricas apenas se desejar testá-las.
2. Entre com o e-mail Firebase confirmado. Escolha `book-001`, confira titulo e preco na Kiwify.
3. Conclua um pagamento real controlado (nao simule pedido aprovado no Firestore).
4. Em Kiwify > Apps > Webhooks > Ver logs, valide HTTP 200 para a notificacao assinada.
5. Execute `node scripts/audit-commerce-status.cjs --project=petlovepro-ae222`: deve existir um pedido aprovado e uma biblioteca atualizada. Consulte o site em **Minha conta**.
6. Entre na Kiwify com o mesmo e-mail e confirme que somente o livro comprado esta acessivel e que o PDF da aula esta visivel.
7. Confira o outbox do GA4: `sent` apenas se havia consentimento e client_id; caso contrario `skipped` e correto.
8. Para validar reembolso, use o fluxo oficial da Kiwify e verifique revogacao do espelho, preservando direitos de outras compras. Nao altere diretamente o status no Firestore.

## Logs e incidentes

```powershell
gcloud functions logs read commerceGA4Purchase --gen2 --region=southamerica-east1 --project=petlovepro-ae222 --limit=30
firebase functions:log --only kiwifyCommerceWebhookV2 --project petlovepro-ae222
```

Os eventos externos sao processados *pelo menos uma vez*. Um erro apos envio GA4 pode ocasionar retransmissao; `transaction_id=orderId` e estavel para mitigacao, nao e garantia matematica de entrega exatamente uma vez. Um outbox `failed` deve ser inspecionado manualmente: mudar apenas o status no documento nao dispara `onDocumentCreated` novamente.

## Limites desta entrega

- Nao criamos webhooks no painel Kiwify, nao enviamos pagamentos e nao alteramos Firebase remotamente.
- Nao temos aqui a versao integral da sua arvore Git com todos os scripts legados; a atualizacao se limita a arquivos da integracao e preserva o resto.
- Nao afirmamos que todos os 50 anexos estao acessiveis em visao de aluno ou que o GA4 ja recebe eventos. Ambos precisam de homologacao real.
- Nao modificamos as regras `firestore.rules`: confira as regras atuais antes de dar acesso direto a dados comerciais ou liberar o portal.
