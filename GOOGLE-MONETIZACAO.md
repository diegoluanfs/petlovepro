# PetLovePro — Analytics + AdSense

## Instalação
Extraia este pacote na raiz do projeto (mantendo as pastas). Execute:

```powershell
node scripts/install-analytics.cjs
npm test
npm run check:release
```

O instalador adapta o HTML, a política de privacidade e a lista pública e cria/mescla `public/ads.txt`. Backups dos arquivos originais modificados ficam em `private/analytics-backup/`. Não altera Firebase, Kiwify, catálogo ou CI. Não adiciona dependências. Se detectar tags Google já coladas diretamente no HTML, para sem aplicar a transformação; não duplique tags. O v0.4.4 e o pacote CI Cloudflare foram usados como base de testes; adapte qualquer divergência do projeto atual antes de publicar.

## Analytics (Google Tag Manager)
- Container `GTM-NNP2S2QS`. O site inicializa a dataLayer, envia consentimento negado por padrão e carrega GTM somente quando o visitante autoriza estatísticas em HTTPS no domínio oficial/apelido www.
- No painel GTM, crie a **Google tag** com o ID de medição `G-...` da propriedade GA4, acionador de todas as páginas e publique o container. Não use o ID GTM como ID GA4. Revise as tags do container: só Analytics nesta instalação, sem tags publicitárias, sem coleta de dados pessoais ou user-provided data. Não coloque o AdSense no GTM além do carregador deste pacote.
- Verifique o Tag Assistant e o relatório Tempo real do GA4 em produção após aceitar estatísticas. Recuse em uma janela anônima e confira que gtm.js não é solicitado. Não são enviados eventos personalizados de comércio eletrônico nesta versão.

## AdSense
- Publisher `ca-pub-9294489692358309`. `ads.txt` será publicado na raiz do domínio; use esse método para verificar a propriedade no painel AdSense. Confirme que a conta possui esse publisher e que a entrada sugerida no painel coincide. A aprovação do site e a exibição dependem do Google.
- A constante `ADS_ENABLED` em `public/analytics.js` começa em `false` como trava de pré-lançamento. Configure primeiro, no AdSense, Privacidade e mensagens: uma CMP certificada pelo Google e integrada ao TCF para EEE, Reino Unido e Suíça (a solução do próprio Google é uma opção). O banner local não é CMP certificada e não a substitui. Configure as mensagens e verifique a integração em regiões aplicáveis antes de veicular anúncios. A opção local de publicidade autoriza apenas anúncios não personalizados; ela não substitui as escolhas exigidas pela CMP. Configure também não personalização no painel conforme aplicável e confirme o comportamento real. Não habilite se a configuração de consentimento ainda não estiver pronta.
- No painel, configure Anúncios automáticos com baixa densidade; recomendo desativar vinhetas, âncoras e formatos que interfiram nas ações de compra. Sem IDs de blocos (`data-ad-slot`) não são criadas vagas de anúncios manuais. Se o Google exigir outro código de CMP, incorpore-o conforme documentação antes da ativação.
- Após a configuração e aprovação, altere **somente** `export const ADS_ENABLED = false;` para `export const ADS_ENABLED = true;` no arquivo `public/analytics.js`. O visitante terá que escolher novamente; sem consentimento de publicidade, o carregador AdSense não entra. As opções de Analytics e publicidade são independentes, com revogação no rodapé. O site tenta limpar cookies próprios conhecidos e recarrega após revogação; não promete apagar cookies de terceiros.
- Valide em produção com DevTools: sem consentimento não deve carregar GTM nem AdSense; estatísticas somente carrega GTM; publicidade somente carrega o script AdSense. Teste a CMP, a revogação e se os anúncios interferem no layout. Não clique nos seus próprios anúncios.

## Publicação
```powershell
git status
git add public/index.html public/app.js public/analytics.js public/analytics.css public/ads.txt scripts/install-analytics.cjs scripts/check-public.cjs test/analytics.test.cjs GOOGLE-MONETIZACAO.md
git commit -m "feat: integrate consent-based Google Analytics and AdSense"
git push origin main
```
Seu fluxo CI/CD Cloudflare deve publicar o conteúdo após os testes. Verifique `https://petlovepro.com.br/ads.txt` e a página inicial após o deploy. Não envie a pasta private nem tokens.

## Limitações
80 testes automatizados passaram na base combinada v0.4.4 + CI + pacotes Kiwify (74 anteriores + 6 novos). Os testes de tags simulam DOM/armazenamento; não foram feitos pedidos reais aos serviços Google. A verificação `check:release` exige as 73 capas reais que estão no seu PC. Os testes de staging usam imagens de teste. Nenhum deploy ou configuração nos painéis Google foi realizado.
