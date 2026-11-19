# Blog PetLovePro v1

Atualização incremental para o projeto v0.4.4 com os instaladores Google Analytics/AdSense e SEO v1 já aplicados. Não substitui o catálogo, Firebase, imagens, Kiwify, dependências ou workflow.

## Instalação (PowerShell na raiz do projeto)

Extraia o ZIP na raiz. Confira os seis artigos em `content/blog.json` antes de publicar. Foram redigidos para fins educativos com referências externas; não passaram por revisão clínica veterinária. Não alegue revisão clínica. Imagens reutilizadas do acervo promocional já aprovado, não são novas fotos.

```powershell
node scripts/install-blog.cjs
npm test
npm run check:release
```

O instalador é idempotente, exige o hook SEO anterior e salva o original em `private/blog-backup/scripts/stage-cloudflare.cjs`. Se detectar uma estrutura incompatível, interrompe sem sobrescrever. Mantenha `private/` fora do Git.

## Visualização (sem publicar)

```powershell
$stage = node scripts/stage-cloudflare.cjs $env:TEMP
if ($LASTEXITCODE -ne 0) { throw 'Falha na preparação do site' }
python -m http.server 5174 --directory (Join-Path $stage 'public')
```

Abra http://localhost:5174/blog/ . Ctrl+C encerra o servidor. A pasta temporária pode ser removida depois. O comando habitual `npm run dev` não gera as rotas novas. O staging exige todas as 73 capas reais. No ambiente local, o analytics deve permanecer inativo. Confira o layout no celular e no desktop.

## Publicação (após revisão)

```powershell
git status
git add content/blog.json scripts/blog-pages.cjs scripts/install-blog.cjs scripts/stage-cloudflare.cjs test/blog-pages.test.cjs BLOG-PETLOVEPRO.md
git commit -m "feat: launch PetLovePro editorial blog"
git push origin main
```

No GitHub Actions o staging roda SEO e depois blog. O diretório de origem `public/` permanece sujeito à lista estrita de arquivos autorizados. O gerador lê somente o catálogo público, HTML, sitemap e o JSON editorial; não copia e-books, credenciais ou arquivos de `private/`. Cria sete páginas estáticas no staging, inclui links no menu da home e dos guias, e acrescenta sete URLs ao sitemap existente (19 URLs nesta versão). As páginas reutilizam o banner de consentimento caso instalado, não ativam AdSense, e replicam a metatag de propriedade AdSense se ela já estiver no HTML público de origem.

Após conclusão do deploy, confira `/blog/`, uma página individual e `/sitemap.xml` no domínio oficial. Envie o sitemap no Search Console. Não há garantia de indexação ou aceitação no AdSense. Nenhuma oferta comercial é ativada.

## Manutenção

Edite `content/blog.json`: slug permanente, título, descrição, categoria, número da coleção, imagem promocional permitida, texto, seções, checklist e referências HTTPS de instituições autorizadas. Teste antes do push. Ao mudar a quantidade inicial de artigos, adapte as asserções de contagem na suíte. Revisão editorial e veterinária recomendada antes de publicar; confirme direitos de uso das imagens. Evite publicar alegações médicas sem revisão. Novas fontes confiáveis podem ser adicionadas à lista de domínios com revisão de código.

## Validação desta entrega

Testes de geração/integração com base nos pacotes anteriores. Não houve acesso à cópia atual do computador, deploy, avaliação clínica ou validação visual com as capas reais. Os testes de staging usam imagens WebP de teste, nunca distribuídas neste ZIP.
