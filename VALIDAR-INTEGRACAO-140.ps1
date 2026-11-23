param(
  [switch] $Online
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
if (-not (Test-Path '.\firebase.commerce.json')) { throw 'Execute dentro da raiz PetLovePro.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js nao encontrado.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm nao encontrado.' }
Write-Host 'PetLovePro v1.4.0: executando testes e auditoria local...'
& npm run verify
if ($LASTEXITCODE -ne 0) { throw 'Verificacao local falhou; nao publique.' }
Write-Host 'Testes aprovados. Nenhuma escrita remota foi realizada.'
if ($Online) {
  Write-Host 'Consultando site publicado (somente GET)...'
  & node '.\scripts\preflight-commerce.cjs' '--base=https://petlovepro.com.br'
  if ($LASTEXITCODE -ne 0) { throw 'Site publicado precisa ser atualizado ou homologado.' }
  Write-Host 'Conferindo bloqueios do webhook (sem compras)...'
  & node '.\scripts\probe-commerce-webhook.cjs'
  if ($LASTEXITCODE -ne 0) { throw 'Webhook exige revisao.' }
}
Write-Host 'Validacao concluida. Nenhuma compra ou deploy foi executado.'
