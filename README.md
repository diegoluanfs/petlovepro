# PetLovePro v0.4.4 — Kiwify Edition

Vitrine editorial independente: 10 coleções, 50 e-books, 73 imagens promocionais. Firebase Hosting, Authentication (Google e e-mail/senha), Firestore e Cloud Functions (Node 22, us-central1). Kiwify cuida do checkout, pagamento e entrega pela área de membros. O Firebase só registra contas, preferências, mapeamentos comerciais e histórico de vendas. O acervo nunca integra a hospedagem nem o backend.

## Atualização local (Windows PowerShell)

Pare o servidor (`Ctrl+C`) e extraia o ZIP de atualização na raiz do projeto existente. Não delete `coleções/`, `public/assets/covers/`, `.firebaserc`, configurações locais nem dados do Firebase. Não execute `firebase init`. A atualização mantém `firebase-config.js` apontando para `petlovepro-ae222`. Se tiver ativado produtos antes desta versão, revise a nova configuração comercial: a distribuição parte com as 60 ofertas desativadas.

```powershell
cd C:\Users\diego\Desktop\projetos\petlovepro
npm --prefix functions install
npm test
npm run check:public
```

Se as 73 imagens ainda não estiverem disponíveis em `public/assets/covers`, importe novamente:

```powershell
python -m pip install -r scripts/requirements-covers.txt
npm run covers
npm run check:release
```

O importador usa exatamente os 73 caminhos de `scripts/cover-plan.json`: 50 capas, 10 capas de coleções, 10 apresentações e 3 fotos. Reprocessa apenas imagens WebP/JPEG, sem metadados; não abre livros, amostras PDF, EPUB, HTML, MD, bônus, auditoria ou catálogos privados. Revise visualmente as imagens reais para confirmar que não contêm páginas ou conteúdo reservado aos compradores. Se necessário: `python scripts/generate-covers.py --source "D:/coleções"`.

```powershell
npm run dev
```

Abra http://localhost:5173. O site continua navegável sem cadastro e sem e-mail confirmado. Minha conta, preferências e checkout exigem verificação, com exceções para autenticação, verificação e logout.

## Configurar Kiwify (antes de habilitar vendas)

1. Comece com um único produto e valide todo o fluxo. Crie os produtos com pagamento único e entrega via Área de Membros Kiwify. Anexe os PDFs e bônus diretamente na área restrita. Para e-books individuais e coleções, configure os grupos de acesso correspondentes aos títulos comprados; não conceda acesso ao catálogo inteiro por engano. A mesma área pode ser reutilizada na criação dos produtos, com grupos separados. DRM Social é opcional e reduz redistribuição; confira as dimensões dos PDFs, as informações pessoais impressas e a experiência do comprador. EPUB não tem garantia de DRM equivalente. Nunca hospede originais no Firebase ou GitHub.
2. Copie o ID **do produto** da Kiwify e o link real do checkout (host `pay.kiwify.com.br`). Nesta versão, cada oferta do catálogo precisa de um ID de produto Kiwify próprio: 50 individuais e 10 coleções. Se compartilhar um produto entre várias ofertas, ou usar order bump/combos, será necessário validar o payload e estender o mapeamento por oferta/itens antes de ativá-los. Não interpretamos dados de adicionais de forma automática. Os preços sugeridos são apenas R$ 24,90 e R$ 79,90, não publicados.
3. Gere o plano comercial local:

```powershell
npm run commerce:template
```

O comando cria `private/kiwify-products.local.json` com os 60 produtos, sem credenciais, sem preços reais, e sem substituir um plano já existente. No arquivo, preencha somente os produtos reais: `kiwifyProductId`, `checkout`, `price` (centavos BRL), `enabled: true`, `checkoutEnabled: true`. A chave global `enabled` deve continuar `false` enquanto os testes não estiverem prontos. Os IDs internos são `001` até `050`, `nutricao-natural` e `colecao-02` até `colecao-10`.

```powershell
npm run commerce:catalog
```

O comando valida a configuração, gera `private/firestore-kiwify-plan.local.json` com os documentos e ajusta **somente preços e disponibilidade** em `public/catalog.js` (nenhum link/ID externo no frontend). Ele não chama APIs nem escreve no Firebase. No console Firestore, copie os documentos do plano manualmente, respeitando tipos e caminho:

- `commerce/kiwify`: `enabled` (boolean), inicialmente `false`.
- `kiwifyProducts/{ID_REAL_DO_PRODUTO_KIWIFY}`: `catalogId` (string), `title` (string), `checkout` (string), `price` (number em centavos), `enabled` (boolean), `checkoutEnabled` (boolean). O ID do documento é o ID externo, não o código interno do e-book. Não use IDs fictícios no ambiente de produção. Preserve os mapeamentos de vendas históricas; para desativar um produto existente altere as flags, não o remova. Se trocar o ID externo, desative o anterior manualmente. O plano não exclui nem atualiza documentos remotos automaticamente.

O backend compara o preço exibido pelo site com o valor configurado no Firestore, não com uma consulta online à Kiwify. Confira os preços finais diretamente na Kiwify antes de vender. Para habilitar, ajuste a chave global local e a do Firestore para `true`, regenere o catálogo e publique após testes. Se precisar pausar as compras, desligue `commerce/kiwify.enabled` imediatamente e regenere o catálogo com `enabled: false`.

## Implantar backend e webhook

O plano Blaze é necessário. Preserve a função `registered` existente; não alteramos sua implementação. O webhook usa o secret `KIWIFY_WEBHOOK_TOKEN`, já criado anteriormente. O valor precisa ser o token **real do webhook Kiwify**, não o token temporário nem a chave da API. Prepare a configuração na Kiwify (Apps > Webhooks); a URL HTTPS esperada da função é `https://us-central1-petlovepro-ae222.cloudfunctions.net/kiwifyWebhook`, mas confirme a URL emitida pelo CLI após deploy. Não habilite vendas enquanto contrato e assinatura não estiverem comprovados.

```powershell
firebase functions:secrets:set KIWIFY_WEBHOOK_TOKEN --project petlovepro-ae222
firebase deploy --only "functions:syncProfile,functions:kiwifyWebhook" --project petlovepro-ae222
firebase functions:list --project petlovepro-ae222
```

Se precisar implantar antes de obter o token da Kiwify, implante somente `syncProfile` ou use o segredo temporário existente, mantendo o webhook comercial não configurado. Substitua o segredo e reimplante `kiwifyWebhook` quando obtiver o token correto. Não compartilhe tokens, nem em chat, logs, arquivos públicos ou Git. Confira que o endpoint HTTP do webhook aceita chamadas externas e que assinaturas inválidas retornam 401. Mantenha `firestore.rules` com acesso direto negado. O SDK Admin acessa com permissões de serviço. Não delete coleções Shopify, dados de clientes ou segredos por conveniência.

Na Kiwify, selecione os eventos de compra aprovada, reembolso e chargeback. Use o teste de webhook e confira os logs, incluindo formato da assinatura e dos campos. O contrato implementado usa `signature` hexadecimal HMAC-SHA1 na query, aplicado aos bytes originais; não tenta mecanismos alternativos sem autenticação. Documentação de ajuda: https://ajuda.kiwify.com.br/pt-br/article/como-funcionam-os-webhooks-2ydtgl/ . A documentação detalhada de vendas vinculada pela ajuda não pôde ser aberta na revisão; a implementação se baseia no código anterior, no exemplo indexado e em referências complementares. Valide obrigatoriamente com um evento autêntico antes de liberar checkout. Se o teste do painel usar produto fictício, a resposta 422 (produto não mapeado) é esperada; não crie mapeamentos falsos em produção para contornar isso. Para testar persistência, prefira um ambiente de testes e uma compra controlada de produto real mapeado. Não trate o teste do painel como prova de entrega real do e-book.

## Dados e garantias

- `customers/{uid}`: perfil Firebase, estado de verificação, interesse e consentimento promocional separado.
- `commerce/kiwify`: chave global de checkout.
- `kiwifyProducts/{product_id}`: mapeamento privado por produto de venda.
- `orders/{hash(order_id)}`: pedido, produto, hash do e-mail normalizado, e-mail do comprador, status, timestamps. Valor/currency somente quando presentes em formato reconhecido no evento aprovado; não representam preço líquido ou faturamento conciliado. Confirme o contrato financeiro antes de criar relatórios.
- `webhookEvents/{hash(order_id:status)}`: auditoria idempotente dos eventos processados. Não guardamos corpo bruto, CPF, cartão, telefone ou endereço.

A função `syncProfile` valida o usuário real com Admin SDK e consulta somente pedidos do e-mail verificado. Compras anteriores ao cadastro aparecem depois do login com o mesmo endereço. A vinculação é por e-mail, não uma identidade compartilhada com Kiwify; e-mails divergentes exigem conciliação manual, e não há SSO. O usuário não pode enviar e-mail para buscar pedidos de terceiros. Compras reembolsadas/contestadas não voltam a aprovadas por eventos atrasados ou repetidos. A mudança de estado no Firebase atualiza o histórico, não altera o acesso na Kiwify: o controle de entrega/revogação pertence à área de membros. URLs diretas, uma vez conhecidas, podem ser acessadas fora do site; a verificação de e-mail só protege o fluxo iniciado na PetLovePro. O frontend encaminha UTMs e parâmetros de rastreamento permitidos ao checkout, preservando os parâmetros já configurados. Não cria afiliados, descontos, bumps ou upsells automaticamente. Configure esses recursos na Kiwify, com validação de pedidos adicionais antes da liberação.

## Validação antes de vender

1. Verificar cliente Google, cliente com e-mail pendente, confirmação e logout.
2. Validar imagem de cada produto e ausência de arquivos privados públicos.
3. Com apenas um produto real configurado, verificar checkout, preço e encaminhamento de parâmetros de campanha. A partir de uma conta não verificada, o backend deve negar o checkout.
4. Validar assinatura real, compra aprovada, duplicidade, estorno, chargeback (eventos controlados) e o histórico após atualizar Minha conta. Confirmar que a conta de outro e-mail não vê o pedido. Não envie segredos ou dados pessoais reais em logs de suporte.
5. Confirmar e-mails de entrega, restrição por produto/grupo, revogação de acesso na Kiwify e DRM. Não habilitar as demais ofertas sem revisão técnica/editorial, termos, suporte, consentimento e política LGPD. Preencha os dados do vendedor em `public/catalog.js`.

## Publicar somente o site

```powershell
npm run check:release
firebase deploy --only hosting --project petlovepro-ae222
```

O deploy é opcional até aprovação. `firebase.json` publica apenas `public/` e exige 73 imagens e a lista de arquivos públicos autorizados. Não rode servidor na raiz; `npm run dev` serve `public/`. O Git ignora os acervos e planos privados, mas isso não remove arquivos que já foram rastreados. Confira `git ls-files -- coleções/ colecoes/ private/` e `git diff --cached --name-only`. Não adicione `functions/node_modules` ou credenciais. O push não é deploy. Não foram modificados console, DNS, loja ou dados remotos nesta entrega.
