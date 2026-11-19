# PetLovePro — SEO técnico v1

## Instalação
Extraia os arquivos na raiz do projeto. Requer a estrutura PetLovePro v0.4.4 e o script de staging do Cloudflare já instalado. Não requer novas dependências, tokens ou alteração do Firebase/Kiwify.

```powershell
node scripts/install-seo.cjs
npm test
npm run check:release
```

O instalador aplica um único hook em `scripts/stage-cloudflare.cjs` e conserva a versão anterior em `private/seo-backup/`. O gerador trabalha sobre a cópia isolada do site, depois da validação da pasta `public`. Gera 11 páginas novas: `/guias/` e uma página de cada coleção. O sitemap final inclui 12 URLs contando a home. O link de navegação é acrescentado ao rodapé da cópia publicada. Nenhum arquivo privado é copiado; dados de livros são limitados a ID, coleção, título, descrição, espécie e capa promocional. As páginas não disponibilizam compras diretamente nem contêm URLs de checkout. O catálogo original continua responsável por verificar disponibilidade.

## Prévia local (opcional; requer as 73 capas existentes)
```powershell
$stage = node scripts/stage-cloudflare.cjs $env:TEMP
if ($LASTEXITCODE -ne 0) { throw 'Falha na preparação do site' }
python -m http.server 5174 --directory (Join-Path $stage 'public')
```
Abra http://localhost:5174/guias/ . Interrompa com Ctrl+C. O site normal (npm run dev) não gera as páginas de SEO; elas só existem na cópia de staging. Se a integração de consentimento Google estiver instalada, as páginas usam a mesma lógica e o armazenamento da origem; tags não são carregadas em localhost. A chave de anúncios existente permanece intacta.

## Publicação
```powershell
git status
git add scripts/seo-pages.cjs scripts/install-seo.cjs scripts/stage-cloudflare.cjs test/seo-pages.test.cjs SEO-PETLOVEPRO.md
git commit -m "feat: add static collection pages and search sitemap"
git push origin main
```
Confirme que o GitHub Actions concluiu com sucesso. Se a integração Google anterior ainda não foi instalada/publicada, faça isso separadamente. Não inclua backups, tokens, PDFs ou arquivos de configuração comerciais privados no Git.

## Search Console
1. Em https://search.google.com/search-console, adicione a propriedade de domínio `petlovepro.com.br` (se ainda não existe).
2. Se necessário, copie o TXT de verificação fornecido pelo Google e adicione no DNS da Cloudflare (nome @). Não altere os registros existentes.
3. Após confirmar a propriedade e o deploy, envie `https://petlovepro.com.br/sitemap.xml` em Sitemaps.
4. Inspecione a home e uma página de coleção; solicite indexação se desejar. A geração de páginas e o envio de sitemap não garantem indexação ou posição no Google.

## Limites
Testes locais em uma cópia da v0.4.4 com os pacotes anteriores; covers nas provas de staging são fixtures como nos testes existentes. Não validado com o acervo real, Search Console ou deploy de produção. Mantém 10 páginas de coleção, em vez de 50 páginas individuais com textos curtos e repetitivos. Conteúdo editorial mais completo será necessário para páginas individuais e blog. Não afeta a identidade visual nem os vínculos de acesso da Kiwify. Não habilita anúncios ou vendas. 
