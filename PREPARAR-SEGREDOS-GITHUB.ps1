# Windows PowerShell 5.1 / PowerShell 7
# Requer GitHub CLI autenticado: gh auth login
[CmdletBinding()]
param([string]$Repositorio = 'diegoluanfs/petlovepro')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) nao instalado. Instale com: winget install --id GitHub.cli -e'
}
& gh auth status
if ($LASTEXITCODE -ne 0) { throw 'Execute gh auth login antes de continuar.' }
$entries = @(
    @{ File='data/release-policy.json'; Secret='PLP_RELEASE_POLICY_B64' },
    @{ File='data/kiwify-products-verified.tsv'; Secret='PLP_KIWIFY_PRODUCTS_B64' },
    @{ File='data/kiwify-offers-verified.private.json'; Secret='PLP_KIWIFY_OFFERS_B64' }
)
foreach ($entry in $entries) {
    $path = Join-Path $PSScriptRoot $entry.File
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Arquivo local ausente: $($entry.File)" }
    $bytes = [IO.File]::ReadAllBytes($path)
    $encoded = [Convert]::ToBase64String($bytes)
    if ($encoded.Length -ge 48000) { throw "Limite GitHub Secrets excedido: $($entry.File)" }
    # Envia via stdin para NAO colocar os dados em argumentos de processo nem exibi-los.
    $encoded | gh secret set $entry.Secret --repo $Repositorio
    if ($LASTEXITCODE -ne 0) { throw "Falha ao definir segredo $($entry.Secret)" }
    Write-Host "GitHub Secret configurado: $($entry.Secret)" -ForegroundColor Green
}
Write-Host 'Segredos configurados. Nenhum arquivo comercial foi adicionado ao Git.' -ForegroundColor Green
