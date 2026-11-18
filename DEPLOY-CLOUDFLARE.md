# PetLovePro — CI/CD (Cloudflare Pages)

Adição de infraestrutura compatível com a versão 0.4.4. O site é estático, publicado na Cloudflare Pages; Firebase Authentication, Firestore, Cloud Functions e Kiwify permanecem inalterados. O deploy do backend continua manual. Não use a integração Git nativa do Pages em paralelo com este workflow.

## Configurar apenas uma vez

1. Faça login na Cloudflare via PowerShell e crie um projeto Pages **Direct Upload**, com branch de produção `main`. Se existir um projeto chamado `petlovepro`, verifique a propriedade e a branch de produção antes de reutilizá-lo; não exclua recursos existentes para resolver conflitos.

```powershell
npx --yes wrangler@4.136.3 login
npx --yes wrangler@4.136.3 pages project create petlovepro --production-branch main
```

2. Cloudflare Dashboard > API Tokens: crie um token personalizado `PetLovePro - GitHub Actions`, com Account > Cloudflare Pages > Edit e apenas a conta que contém este projeto. Não use Global API Key. Copie o Account ID (Overview do domínio > API). Não compartilhe o token nem o grave no repositório.
3. GitHub > diegoluanfs/petlovepro > Settings > Secrets and variables > Actions > New repository secret. Adicione `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. Não há necessidade de credenciais do Firebase nesta automação.
4. Extraia o ZIP de atualização na raiz do repositório. As imagens reais devem estar em `public/assets/covers/`, ser aprovadas visualmente e estar versionadas. Rode `npm run covers` localmente se necessário (depende do acervo privado, que não deve ser enviado ao GitHub). Rode `npm test` e `npm run check:release`. Confira os arquivos rastreados com `git ls-files -- coleções/ colecoes/ private/` e verifique também todos os arquivos staged por extensões privadas e credenciais. Se arquivos privados já estiverem no histórico, ignorá-los não desfaz a exposição; trate antes de publicar. O workflow não recebe os livros completos nem regenera capas.
5. Faça commit dos arquivos de CI/CD e das capas aprovadas, se não estiverem versionadas. Faça push à `main`. Confira os logs em https://github.com/diegoluanfs/petlovepro/actions. O pipeline roda testes em pull requests; deploy só acontece em push à main ou execução manual na main. Os segredos são utilizados apenas na etapa de deploy. O diretório de deploy é isolado do repositório para não empacotar `functions/` do Firebase como Cloudflare Pages Functions. São adicionados os cabeçalhos de segurança e um 404 real. Não são alteradas as configurações do Firebase Hosting já existentes.
6. Confirme a URL `pages.dev` efetivamente atribuída pela Cloudflare. Em Workers & Pages > petlovepro > Custom domains, adicione `petlovepro.com.br` (apex), depois `www.petlovepro.com.br` se desejar. Cloudflare deve gerenciar a zona DNS. Se houver um apontamento já ocupado, confira a sua finalidade antes de substituir somente o registro conflitante; preserve MX, TXT e outros registros de e-mail. Configure redirecionamento de www para o domínio principal opcionalmente. Não crie registros CNAME antes de associar o domínio pelo próprio Pages.
7. Firebase Authentication > Settings > Authorized domains: autorize `petlovepro.com.br`, `www.petlovepro.com.br` se usado, e a URL Pages (somente o hostname) se desejar testar autenticação nela. Preserve `authDomain` atual (`petlovepro-ae222.firebaseapp.com`), pois o popup do Google usa o domínio Firebase. Se houver restrições de HTTP referrer na chave pública do Firebase, inclua os hosts necessários. Teste login Google, login e-mail/senha, verificação, recuperação de senha, logout, consulta de perfil e preferências. O checkout depende da configuração Kiwify, permanece desabilitado até validação comercial.

## Operação

`git push origin main` dispara a validação e o deploy; caso falhem os testes ou a lista de arquivos públicos, a etapa de deploy não executa. Para repetir manualmente: GitHub Actions > PetLovePro CI/CD - Cloudflare Pages > Run workflow > main. Para rollback, use a opção de rollback de uma implantação anterior no painel Pages ou reverta o commit e faça push novamente.

Confirme, após a associação do domínio:

```powershell
curl.exe -I https://petlovepro.com.br/
curl.exe -I https://petlovepro.com.br/assets/covers/book-001.webp
curl.exe -I https://petlovepro.com.br/ebook.pdf
curl.exe -I https://petlovepro.com.br/ebook.epub
curl.exe -I https://petlovepro.com.br/functions/index.cjs
```

Esperado: 200 para a home e capa, 404 para os demais. As capas públicas podem ser salvas pelos visitantes. PDFs, EPUB, arquivos HTML editoriais, bônus, credenciais e backend não integram a publicação. O isolamento não substitui revisão editorial/visual, segurança do GitHub ou validação real da Kiwify.

Referências: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/ ; https://developers.cloudflare.com/pages/configuration/custom-domains/ ; https://developers.cloudflare.com/pages/configuration/headers/ .
