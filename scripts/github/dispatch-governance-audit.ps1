param(
  [string]$Ref = "main",
  [string]$Month = ""
)

if (-not $env:GITHUB_TOKEN) {
  Write-Error "GITHUB_TOKEN nao encontrado. Defina a variavel de ambiente antes de executar."
  exit 1
}

$owner = "mauriciofsoares"
$repo = "MenuCare"
$workflowId = "governance-audit.yml"

$headers = @{
  Authorization = "Bearer $($env:GITHUB_TOKEN)"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$workflowUri = "https://api.github.com/repos/$owner/$repo/actions/workflows/$workflowId"
$dispatchUri = "https://api.github.com/repos/$owner/$repo/actions/workflows/$workflowId/dispatches"

$inputs = @{}
if (-not [string]::IsNullOrWhiteSpace($Month)) {
  if ($Month -notmatch "^\d{4}-\d{2}$") {
    Write-Error "Formato invalido para -Month. Use AAAA-MM, por exemplo 2026-07."
    exit 1
  }

  $inputs.month = $Month
}

$body = @{
  ref = $Ref
  inputs = $inputs
}

function Get-ApiErrorMessage {
  param($ErrorRecord)

  $statusCode = $null
  $responseBody = ""

  if ($ErrorRecord.Exception.Response) {
    try {
      $statusCode = [int]$ErrorRecord.Exception.Response.StatusCode
    } catch {
      $statusCode = $null
    }

    try {
      $stream = $ErrorRecord.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
      }
    } catch {
      $responseBody = ""
    }
  }

  $message = ""
  if ($null -ne $statusCode) {
    $message += "HTTP: $statusCode. "
  }
  if ($responseBody) {
    $message += "Resposta: $responseBody"
  } else {
    $message += "Erro: $($ErrorRecord.Exception.Message)"
  }

  return $message.Trim()
}

try {
  # Preflight: confirma que o workflow existe no remoto na branch de referencia.
  try {
    Invoke-RestMethod -Method Get -Uri $workflowUri -Headers $headers | Out-Null
  } catch {
    $detail = Get-ApiErrorMessage -ErrorRecord $_
    Write-Error "Workflow '$workflowId' nao encontrado no repositorio remoto ou sem permissao para leitura de Actions. Garanta commit/push de .github/workflows/$workflowId na branch '$Ref'. Detalhes: $detail"
    exit 1
  }

  $json = $body | ConvertTo-Json -Depth 6
  Invoke-RestMethod -Method Post -Uri $dispatchUri -Headers $headers -Body $json -ContentType "application/json" | Out-Null

  if ($inputs.ContainsKey("month")) {
    Write-Host "Workflow Governance Audit disparado com sucesso para $owner/$repo (ref=$Ref, month=$Month)."
  } else {
    Write-Host "Workflow Governance Audit disparado com sucesso para $owner/$repo (ref=$Ref, month=automatico)."
  }
} catch {
  $detail = Get-ApiErrorMessage -ErrorRecord $_
  Write-Error "Falha ao disparar workflow Governance Audit: $detail"
  exit 1
}
