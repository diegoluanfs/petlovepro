# PetLovePro — cadastro comercial e imagens

Complemento da biblioteca v1.1. Extraia na raiz do projeto, substituindo apenas os arquivos presentes no ZIP. Usa o OAuth local já instalado. Mantém os PDFs privados e não publica aulas, não altera preços existentes, não altera webhooks, não habilita a loja e não grava no Firebase. Não execute em paralelo com outra automação de cadastro.

**Atenção:** `product_create` pode criar um produto e checkout imediatamente ativos na Kiwify. O MCP não oferece os campos necessários para vincular uma oferta a um grupo, nem a ferramenta de pausa na conexão utilizada. Não anuncie links até que a entrega esteja configurada; se necessário, pause produtos no painel. O novo comando exige `--accept-active-checkouts` para aceitar esse comportamento. O catálogo local e Firestore devem continuar com vendas desativadas.

## 1. Inventário e criação

```powershell
npm test
node scripts/kiwify-commercial.cjs create
```

A prévia consulta a loja e detecta títulos duplicados, preços divergentes e IDs incompatíveis. O cadastro utiliza os títulos e as descrições de `public/catalog.js`, R$ 24,90 por livro, R$ 79,90 por coleção, cobrança única, área já existente. O primeiro produto é preservado. Confira a prévia, então use:

```powershell
node scripts/kiwify-commercial.cjs create --all --apply --confirm=petlovepro --accept-active-checkouts
```

Opcionalmente acrescente `--limit=5` para um lote menor. Se houver limite explícito de chamadas, o script espera 65 segundos, consulta novamente o inventário e só tenta criar novamente se não localizar o produto; até duas retentativas. Timeout ou outra falha de escrita incerta interrompe o lote, sem repetição automática. Antes de executar de novo, verifique inventário e painel. O relatório da última execução fica em `private/kiwify-commercial-create.local.json`.

## 2. Capas comerciais

Não confundir com as capas dos cursos já enviadas. Gera arquivos JPEG de 300 × 250 px a partir das imagens WebP promocionais importadas no site, sem cortar as capas nem ler PDFs. Pillow deve estar instalado (já usado no `npm run covers`).

```powershell
python scripts/kiwify-commercial-images.py
node scripts/kiwify-commercial.cjs covers --product=001 --apply --confirm=petlovepro
```

Confira o piloto no painel da Kiwify. Se aprovado:

```powershell
node scripts/kiwify-commercial.cjs covers --all --apply --confirm=petlovepro
```

O script preserva imagem existente, verifica produto e oferta, envia o arquivo diretamente ao armazenamento indicado pelo MCP, confirma a imagem após a associação. Em erro de escrita, interrompe; retomar relê a imagem atual. Uma transferência temporária sem associação pode deixar um arquivo órfão. O relatório fica em `private/kiwify-commercial-covers.local.json`. A aceitação real da imagem e dimensões ainda requer o piloto.

## 3. Mapear as ofertas e verificar a biblioteca

```powershell
node scripts/kiwify-commercial.cjs verify
node scripts/kiwify-commercial.cjs map
```

`verify` verifica os 50 PDFs (nome e tamanho), capas existentes, grupos, aula e descrição em rascunho. Não confirma igualdade criptográfica ou entrega a um comprador. `map` gera `private/kiwify-offer-groups.local.csv` e `.json` com 60 linhas, grupo previsto, IDs e URL do painel. A associação não é gravada ou confirmada automaticamente. Abra cada produto em Produtos > Editar produto > Área de membros > Controle de Acesso e vincule a oferta padrão ao grupo indicado. Não altere o grupo padrão para dar acesso a todos os livros. Deixe as aulas como rascunho até conferir acesso e preparar teste controlado. Não divulgue links. Documentação: https://ajuda.kiwify.com.br/pt-br/article/o-que-sao-e-como-gerenciar-os-grupos-1kkf0al/

## 4. Firebase (pré-lançamento)

```powershell
node scripts/kiwify-library.cjs sync
npm run commerce:catalog
```

O `sync` consulta IDs e links reais e preserva `enabled` global e `checkoutEnabled` como false no plano. Confira que 60 produtos foram mapeados. Para prévia e gravação do plano no Firestore siga `KIWIFY-AUTOMACAO.md` (ADC do Google Cloud, projeto petlovepro-ae222); não publique o catálogo comercial antes dos testes reais. Nenhuma compra, aluno ou publicação é criada pelos comandos do novo script. Os novos testes são simulados. O material editorial e os planos privados não fazem parte do ZIP e não devem ir ao Git.
