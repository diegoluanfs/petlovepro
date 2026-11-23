# PetLovePro — envio local para a biblioteca Kiwify (v1)

Complemento para PetLovePro v0.4.4, não substitui a atualização anterior do CI/CD nem o `kiwify-sync.cjs`. O catálogo fonte é `public/catalog.js`; a área deve ser **PetLovePro — Biblioteca Digital** da conta já conectada. A ferramenta não cria produtos, não exclui arquivos, não publica aulas, não altera preços, não habilita checkouts e não grava no Firebase.

## 1. Conferir a pasta editorial (sem rede)

Na raiz do projeto pelo PowerShell:

```powershell
node scripts/kiwify-library.cjs prepare
npm test
```

`prepare` exige uma única pasta `coleções/` ou `colecoes/`. A estrutura segue as coleções do catálogo e não supõe que a ordem numérica dos livros corresponda à ordem das coleções. Exemplo: `coleções/colecao-01/book-001/ebook.pdf` e `capa.jpg`. Verifica presença, tamanho (até 100 MB por arquivo), assinatura PDF/JPEG e caminho dentro do acervo. Não avalia conteúdo editorial, qualidade de imagem, integridade completa ou restrições específicas de dimensão do serviço. Para diagnóstico de um arquivo: `node scripts/kiwify-library.cjs prepare --book=001`.

## 2. Conexão OAuth a partir do Windows

Node.js 22 ou superior. A dependência `mcp-remote` é uma ponte de terceiros para o endpoint oficial `https://mcp.kiwify.com/mcp`; o SDK MCP é separado do frontend. Os dois ficam em `private/kiwify-tools/` (ignorada pelo Git). Não é necessário informar chaves da API pública ou copiar o token de webhook. O OAuth do ChatGPT não é reutilizado pelo script. A Kiwify deve aceitar o cliente local e a autorização do navegador; essa compatibilidade ainda não foi testada em produção.

```powershell
New-Item -ItemType Directory -Force private/kiwify-tools | Out-Null
npm install --prefix private/kiwify-tools --save-exact @modelcontextprotocol/sdk@1.32.2 mcp-remote@0.16.6 zod@4
npm audit --prefix private/kiwify-tools
```

Revise alertas de segurança que eventualmente aparecerem; não instale globalmente nem use `npm audit fix --force` automaticamente. Em seguida, execute:

```powershell
node scripts/kiwify-library.cjs audit
```

Autorize a conexão no navegador, na conta da PetLovePro, permitindo somente o acesso a Produtos e Área de membros necessário à automação. Não são necessárias permissões de exclusão, remoção, cancelamento ou financeiro. O cliente local confirma o ID da loja antes de continuar. O comando confere os 50 cursos e os 60 grupos, incluindo o grupo padrão, e grava `private/kiwify-library-map.local.json`. Ele não grava no servidor. Caso o OAuth falhe ou o MCP não disponibilize os nomes das ferramentas esperadas, pare; não forneça credenciais pelo chat. A documentação oficial do servidor é https://ajuda.kiwify.com.br/pt-br/article/como-conectar-a-kiwify-a-um-agente-de-ia-kq2kxy/ .

## 3. Testar o livro 001

```powershell
node scripts/kiwify-library.cjs upload --book=001 --apply --confirm=petlovepro
```

Faz a consulta de curso e aula, valida que ainda está em rascunho e que somente os grupos esperados têm acesso, solicita a URL temporária ao MCP, faz PUT direto dos bytes locais, associa o PDF e verifica o retorno com `lesson_get`. Em seguida usa `course_cover_upload` e `club_course_update` para a capa na área de membros (não a imagem comercial do checkout). Se houver uma capa existente, ela não é substituída. Se já existir exatamente um PDF com o nome e tamanho esperados, ele é preservado (nome/tamanho não constituem prova criptográfica de igualdade de conteúdo). Qualquer anexo divergente, erro ou estado inesperado interrompe o processo; não há tentativa automática de duplicar ou sobrescrever. Um PUT concluído sem associação pode deixar um arquivo temporário órfão no armazenamento Kiwify. Confira o painel antes de repetir após uma falha.

Confira o PDF, a capa e a aula ainda não publicada em:
https://dashboard.kiwify.com.br/members-area/ac2fa6f3-2e58-483d-a32b-fb380933aed8?tab=courses&course=8b22a79a-f54c-4d70-8737-c4eddf990d2c

Somente se o primeiro arquivo estiver correto, execute o lote:

```powershell
node scripts/kiwify-library.cjs upload --all --apply --confirm=petlovepro
```

O comando valida 50 arquivos PDF e 50 capas antes de gravar qualquer coisa, depois processa sequencialmente e para no primeiro erro. O relatório privado da execução está em `private/kiwify-library-last-run.local.json`; em uma nova execução o relatório é substituído e os anexos conferidos são pulados. Não envie URLs temporárias ou logs OAuth a terceiros.

## 4. Sincronizar registros comerciais existentes

```powershell
node scripts/kiwify-library.cjs sync
npm run commerce:catalog
```

Consulta produtos realmente existentes no MCP, associa por título exato e ID, confirma que pertencem à área correta e usa a oferta padrão ativa em BRL. O preço decimal vindo do MCP é convertido para centavos no JSON local. Não exige outra API Key. Não modifica o preço remoto. Mantém `enabled` geral em `false` e `checkoutEnabled` de cada produto em `false`. Faz backup do JSON existente, se houver, em `private/kiwify-products.before-mcp.local.json`. A geração de catálogo escreve a versão de prelaunch em `public/catalog.js` e o plano privado do Firestore. Para importar depois, utilize o comando `firestore` da atualização anterior após conferir o projeto e o plano, conforme `KIWIFY-AUTOMACAO.md`.

Ainda falta associar cada oferta ao seu grupo no painel da Kiwify: a ferramenta disponível não expõe esse campo. O produto 001 tem um checkout ativo na Kiwify; não o divulgue enquanto a entrega estiver incompleta. Antes de criar mais produtos ativos, valide a associação e a primeira entrega. As coleções usarão os mesmos PDFs dos cinco livros, sem duplicação. Capas comerciais de produtos/coleções, materiais bônus e configuração DRM serão tratados depois; este script só faz PDF principal e capa de curso individual. A publicação e a liberação de vendas são etapas separadas.

## Testes

`npm test` inclui testes simulados para identidade de catálogo, grupos, permissões, bloqueio de aula publicada, formato, caminhos, destinos HTTPS, expiração de ticket, repetição sem duplicar, upload e sincronização. Os testes não acessam a Kiwify nem precisam das dependências OAuth. A integração real, dimensões aceitas das capas, nomes de ferramentas liberadas para a conexão local e os PDFs existentes no Windows requerem a validação do livro 001.

## Atualização v1.1 — retomada e diagnóstico

Se os livros anteriores já foram verificados, retome no primeiro ID pendente:

```powershell
node scripts/kiwify-library.cjs upload --all --from=021 --apply --confirm=petlovepro
```

`--from` exige `--all` e um ID existente. O lote é ordenado por ID e continua até 050. Para conferir tudo novamente, use `--all` sem `--from`.

O script exibe a operação MCP ou PUT em andamento, espera 500 ms antes de cada chamada MCP e 3 segundos entre livros. Falhas classificadas como temporárias (429, 5xx selecionados e timeout/falha de comunicação reconhecidos) permitem até duas novas tentativas, com intervalos de 30 e 60 segundos. Cada tentativa relê curso e aula antes de decidir se precisa enviar arquivos. Falhas desconhecidas ou de integridade bloqueiam o lote; não há publicação automática. O diagnóstico não imprime o conteúdo bruto de respostas de erro. Consulte `private/kiwify-library-last-run.local.json` para o relatório da última execução; não o versione. O diagnóstico de um erro genérico depende das informações retornadas pelo MCP e pode não identificar a causa raiz.

O patch preserva os arquivos de configuração e credenciais existentes. Não há alteração no frontend nem nas funções Firebase.
