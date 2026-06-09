param(
  [string]$Month,
  [switch]$Strict
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$auditsDir = Join-Path $repoRoot "docs\governance-audits"

if ([string]::IsNullOrWhiteSpace($Month)) {
  $Month = Get-Date -Format "yyyy-MM"
}

if ($Month -notmatch "^\d{4}-\d{2}$") {
  Write-Error "Formato invalido para -Month. Use AAAA-MM, por exemplo 2026-07."
  exit 1
}

$targetPath = Join-Path $auditsDir "$Month.md"

if (-not (Test-Path $targetPath)) {
  Write-Error "Auditoria mensal nao encontrada: $targetPath"
  exit 1
}

$content = Get-Content -Path $targetPath -Raw

$requiredTokens = @(
  "# Auditoria Mensal de Governanca - $Month",
  "## 1. Integridade da CI",
  "## 2. Regras da branch main",
  "## 3. Governanca de revisao",
  "## 4. Triagem de demandas",
  "## 5. Verificacao tecnica local",
  "## 6. Desvios e plano de acao"
)

$missing = @()
foreach ($token in $requiredTokens) {
  if ($content -notmatch [Regex]::Escape($token)) {
    $missing += $token
  }
}

if ($missing.Count -gt 0) {
  Write-Error "Arquivo de auditoria incompleto. Secoes ausentes:`n- $($missing -join "`n- ")"
  exit 1
}

$dataMatch = [Regex]::Match($content, "(?m)^Data da auditoria:\s*(.*)$")
$responsavelMatch = [Regex]::Match($content, "(?m)^Responsavel:\s*(.*)$")
$statusMatch = [Regex]::Match($content, "(?m)^Status geral:\s*(.*)$")

$dataValue = if ($dataMatch.Success) { $dataMatch.Groups[1].Value.Trim() } else { "" }
$responsavelValue = if ($responsavelMatch.Success) { $responsavelMatch.Groups[1].Value.Trim() } else { "" }
$statusValue = if ($statusMatch.Success) { $statusMatch.Groups[1].Value.Trim() } else { "" }

$warnings = @()
if ([string]::IsNullOrWhiteSpace($dataValue)) {
  $warnings += "Data da auditoria nao preenchida."
}
if ([string]::IsNullOrWhiteSpace($responsavelValue)) {
  $warnings += "Responsavel nao preenchido."
}
if ([string]::IsNullOrWhiteSpace($statusValue) -or $statusValue -eq "Conforme / Nao conforme") {
  $warnings += "Status geral ainda em placeholder."
}

if ($warnings.Count -gt 0) {
  if ($Strict) {
    Write-Error "Auditoria encontrada, mas com pendencias em modo estrito:`n- $($warnings -join "`n- ")"
    exit 1
  }

  Write-Host "Auditoria encontrada com alertas:"
  foreach ($w in $warnings) {
    Write-Host "- $w"
  }
} else {
  Write-Host "Auditoria mensal valida para ${Month}: $targetPath"
}

exit 0
