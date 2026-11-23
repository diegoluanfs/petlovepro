param([string]$Projeto = 'C:\Users\diego\Desktop\projetos\petlovepro')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $Projeto
if (-not (Test-Path 'functions-petlovepro\index.js')) { throw 'Extraia o ZIP na raiz do projeto primeiro.' }
if (-not (Test-Path 'data\release-policy.json')) { throw 'Projeto sem mapa comercial. Não continue.' }
node --check '.\functions-petlovepro\index.js'
node '.\scripts\patch-commerce-library.cjs'
if ($LASTEXITCODE -ne 0) { throw 'Falha ao integrar a biblioteca no frontend.' }
node '.\scripts\sync-commerce-firestore.cjs'
if ($LASTEXITCODE -ne 0) { throw 'Falha na auditoria local do catálogo.' }
node --test '.\tests\firebase-library.test.cjs'
if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes da biblioteca.' }
npm run verify
if ($LASTEXITCODE -ne 0) { throw 'Há testes falhando. Não publique.' }
Write-Host 'Validação local concluída. Nada foi gravado no Firebase ou na Kiwify.' -ForegroundColor Green
