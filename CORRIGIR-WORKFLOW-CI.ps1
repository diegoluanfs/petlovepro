# Insere a restauracao segura APOS o checkout do workflow existente, antes de npm test.
# Requer ter copiado o pacote para a raiz do repositorio.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$file = Join-Path $PSScriptRoot '.github/workflows/cloudflare-pages.yml'
if (-not (Test-Path -LiteralPath $file)) { throw 'Workflow nao encontrado: .github/workflows/cloudflare-pages.yml' }
$source = [IO.File]::ReadAllText($file)
if ($source.Contains('restore-commerce-inputs.cjs')) { Write-Host 'Workflow ja corrigido.'; return }
$lines = [regex]::Split($source, '\r?\n')
$checkout = -1
$testIndex = -1
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^\s*(?:-\s*)?run:\s*npm test(?:\s*(?:#.*)?)?$') { $testIndex = $i; break }
}
if ($testIndex -lt 0) { throw 'Passo npm test nao localizado. Ajuste o workflow manualmente.' }
for ($i = 0; $i -lt $testIndex; $i++) {
  if ($lines[$i] -match '^\s*uses:\s*actions/checkout@') { $checkout = $i }
  elseif ($lines[$i] -match '^\s*-\s*uses:\s*actions/checkout@') { $checkout = $i }
}
if ($checkout -lt 0) { throw 'actions/checkout nao localizado antes de npm test.' }
$stepStart = -1
$indent = ''
for ($i=$checkout; $i -ge 0; $i--) {
  if ($lines[$i] -match '^(\s*)-\s+(?:name|uses):\s*') {
    $stepStart = $i; $indent = $Matches[1]; break
  }
}
if ($stepStart -lt 0) { throw 'Nao foi possivel identificar o passo checkout.' }
$next = -1
for ($i=$stepStart + 1; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match ('^' + [regex]::Escape($indent) + '-\s+(?:name|uses|run):\s*')) { $next = $i; break }
}
if ($next -lt 0 -or $next -gt $testIndex) { throw 'Nao foi possivel inserir antes dos testes. Nenhuma alteracao feita.' }
$snippet = @(
  $indent + '- name: Restore private commerce build inputs',
  $indent + '  env:',
  $indent + '    PLP_RELEASE_POLICY_B64: ${{ secrets.PLP_RELEASE_POLICY_B64 }}',
  $indent + '    PLP_KIWIFY_PRODUCTS_B64: ${{ secrets.PLP_KIWIFY_PRODUCTS_B64 }}',
  $indent + '    PLP_KIWIFY_OFFERS_B64: ${{ secrets.PLP_KIWIFY_OFFERS_B64 }}',
  $indent + '  run: node scripts/ci/restore-commerce-inputs.cjs'
)
# Evita a escrita parcial ou mal indentada.
$backup = $file + '.antes-ci-segredos.bak'
Copy-Item -LiteralPath $file -Destination $backup -Force
$updated = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $next; $i++) { $updated.Add($lines[$i]) }
foreach ($line in $snippet) { $updated.Add($line) }
for ($i = $next; $i -lt $lines.Length; $i++) { $updated.Add($lines[$i]) }
$newline = if ($source.Contains("`r`n")) {"`r`n"} else {"`n"}
[IO.File]::WriteAllText($file, ($updated -join $newline), (New-Object Text.UTF8Encoding($false)))
Write-Host 'CI atualizado. Backup criado:' $backup -ForegroundColor Green
Write-Host 'Confira o diff antes de commitar: git diff -- .github/workflows/cloudflare-pages.yml'
