# Integração segura

A versão anterior disponível foi reempacotada sem o código do computador do usuário. A extração sobrepõe arquivos homônimos; não é um merge de Git. Não publicar antes de revisar mudanças locais.

- [ ] Criar backup/commit antes de extrair
- [ ] Revisar `git status` e `git diff`
- [ ] Confirmar Firebase Authentication e domínio
- [ ] Confirmar Firestore e funções existentes
- [ ] `npm run verify`
- [ ] `npm run release:check` (bloqueia se faltarem suporte, identificação e política legal)
- [ ] Conferir todos os URLs na Kiwify e no ambiente de testes
- [ ] Homologar Pix, cartão, estorno e duplicidade do webhook
- [ ] Confirmar que o PDF está em Anexos da aula Kiwify para o comprador autorizado
- [ ] Revisar GA4 e permissões de acesso antes de produção

O `firebase.petlovepro.json` é separado do `firebase.json` existente para evitar alterar regras/firestore/functions acidentalmente. A `functions-petlovepro` possui seus próprios nomes de funções exportadas.
