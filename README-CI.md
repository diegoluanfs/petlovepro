# PetLovePro — Correção da falha ENOENT no GitHub Actions

O catálogo comercial depende de três arquivos ignorados pelo Git; a correção os carrega **somente durante o CI**, usando GitHub Actions Secrets protegidos. O build e as auditorias seguem habilitados.

## Instalação

1. Extraia o ZIP diretamente em `C:\Users\diego\Desktop\projetos\petlovepro` (os arquivos existentes são preservados, salvo as novas ferramentas).
2. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\PREPARAR-SEGREDOS-GITHUB.ps1` (requer `gh auth login`).
3. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\CORRIGIR-WORKFLOW-CI.ps1`.
4. Confira `git diff -- .github/workflows/cloudflare-pages.yml`. A etapa `Restore private commerce build inputs` deve aparecer **depois de `actions/checkout` e antes de `npm test`**. Se o workflow diferir, verifique manualmente a posição; o instalador para sem alterar caso não encontre uma posição segura.
5. Versione apenas os scripts e o workflow, NÃO os três arquivos comerciais: `git add .github/workflows/cloudflare-pages.yml scripts/ci/restore-commerce-inputs.cjs PREPARAR-SEGREDOS-GITHUB.ps1 CORRIGIR-WORKFLOW-CI.ps1 README-CI.md`.
6. Faça `git diff --cached --check`, `git commit -m "fix(ci): restore private commerce build inputs from GitHub Secrets"` e `git push origin main`.

## Secrets esperados (Repository > Settings > Secrets and variables > Actions)

- `PLP_RELEASE_POLICY_B64` ← base64 de `data/release-policy.json`
- `PLP_KIWIFY_PRODUCTS_B64` ← base64 de `data/kiwify-products-verified.tsv`
- `PLP_KIWIFY_OFFERS_B64` ← base64 de `data/kiwify-offers-verified.private.json`

O script de PowerShell registra os três a partir dos arquivos locais, via GitHub CLI. **Base64 não é criptografia.** A confidencialidade vem da infraestrutura de Secrets do GitHub. Não anexe estes arquivos como artefatos e não imprima conteúdos em logs.

## Considerações

- A ação de CI exige acesso aos GitHub Secrets; PRs de forks não recebem esses Secrets. O build falhará de forma segura nesse caso.
- A saída privada `dist/firestore-commerce-plan.private.json` não pode ser publicada no Cloudflare Pages. O pipeline deve implantar **somente** a pasta `site-dist/` ou a área pública validada.
- Verifique se o workflow tem outros passos (como `npm run release:check`) que requerem `data/legal-approval.json`: essa é uma pendência distinta, a tratar com dados reais e aprovação efetiva, sem simular aprovações.
- A correção não configura checkout, não altera Firestore/Kiwify e não publica nada por si só.
