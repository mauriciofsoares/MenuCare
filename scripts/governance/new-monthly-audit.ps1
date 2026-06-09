param(
  [string]$Month,
  [switch]$SkipIfExists
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$auditsDir = Join-Path $repoRoot "docs\governance-audits"
$templatePath = Join-Path $auditsDir "_template.md"

if (-not (Test-Path $templatePath)) {
  Write-Error "Template nao encontrado em $templatePath"
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Month)) {
  $Month = Get-Date -Format "yyyy-MM"
}

if ($Month -notmatch "^\d{4}-\d{2}$") {
  Write-Error "Formato invalido para -Month. Use AAAA-MM, por exemplo 2026-07."
  exit 1
}

$targetPath = Join-Path $auditsDir "$Month.md"

if (Test-Path $targetPath) {
  if ($SkipIfExists) {
    Write-Host "Arquivo ja existe. Nenhuma alteracao realizada: $targetPath"
    exit 0
  }

  Write-Error "Arquivo ja existe: $targetPath. Use -SkipIfExists para encerrar sem erro."
  exit 1
}

$templateContent = Get-Content -Path $templatePath -Raw
$today = Get-Date -Format "yyyy-MM-dd"

$content = $templateContent
$content = $content -replace "AAAA-MM", $Month
$content = $content -replace "(?m)^Data da auditoria:.*$", "Data da auditoria: $today"
$content = $content -replace "(?m)^Responsavel:.*$", "Responsavel: "
$content = $content -replace "(?m)^Status geral:.*$", "Status geral: Conforme / Nao conforme"

Set-Content -Path $targetPath -Value $content -Encoding UTF8
Write-Host "Arquivo de auditoria mensal criado: $targetPath"
