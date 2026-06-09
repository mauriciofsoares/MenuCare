param(
  [string]$Owner = "mauriciofsoares",
  [string]$Repo = "MenuCare",
  [string]$Branch = "main"
)

if (-not $env:GITHUB_TOKEN) {
  Write-Error "GITHUB_TOKEN nao encontrado. Defina a variavel de ambiente antes de executar."
  exit 1
}

function Invoke-GitHubRest {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [object]$Body = $null
  )

  try {
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 10
      return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -Body $jsonBody -ContentType "application/json"
    }

    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
  } catch {
    $statusCode = $null
    $responseBody = ""
    $scopesHeader = ""
    $acceptedPermissionsHeader = ""
    $errorDetailsMessage = ""

    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $errorDetailsMessage = $_.ErrorDetails.Message
    }

    if ($_.Exception.Response) {
      try {
        $statusCode = [int]$_.Exception.Response.StatusCode
      } catch {
        $statusCode = $null
      }

      try {
        if ($_.Exception.Response.Headers) {
          $scopesHeader = $_.Exception.Response.Headers["x-oauth-scopes"]
          $acceptedPermissionsHeader = $_.Exception.Response.Headers["x-accepted-github-permissions"]
        }
      } catch {
        $scopesHeader = ""
        $acceptedPermissionsHeader = ""
      }

      try {
        $stream = $_.Exception.Response.GetResponseStream()
        if ($stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $responseBody = $reader.ReadToEnd()
          $reader.Close()
        }
      } catch {
        $responseBody = ""
      }
    }

    $message = "Falha na chamada GitHub API ($Method $Uri)."
    if ($null -ne $statusCode) {
      $message += " HTTP: $statusCode."
    }
    if ($responseBody) {
      $message += " Resposta: $responseBody"
    } elseif ($errorDetailsMessage) {
      $message += " Resposta: $errorDetailsMessage"
    } else {
      $message += " Erro: $($_.Exception.Message)"
    }

    if ($scopesHeader) {
      $message += " x-oauth-scopes: $scopesHeader"
    }
    if ($acceptedPermissionsHeader) {
      $message += " x-accepted-github-permissions: $acceptedPermissionsHeader"
    }

    throw $message
  }
}

$headers = @{
  Authorization = "Bearer $($env:GITHUB_TOKEN)"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$userUri = "https://api.github.com/user"
$repoUri = "https://api.github.com/repos/$Owner/$Repo"
$protectionUri = "https://api.github.com/repos/$Owner/$Repo/branches/$Branch/protection"

$body = @{
  required_status_checks = @{
    strict = $true
    contexts = @("CI / validate (pull_request)")
  }
  enforce_admins = $true
  required_pull_request_reviews = @{
    dismiss_stale_reviews = $true
    require_code_owner_reviews = $true
    required_approving_review_count = 1
  }
  restrictions = $null
  allow_force_pushes = $false
  allow_deletions = $false
  required_conversation_resolution = $true
  block_creations = $false
  lock_branch = $false
  allow_fork_syncing = $true
}

try {
  $user = Invoke-GitHubRest -Method "GET" -Uri $userUri
  Write-Host "Autenticado como:" $user.login

  $repoInfo = Invoke-GitHubRest -Method "GET" -Uri $repoUri
  $hasAdminPermission = $false
  if ($repoInfo.permissions -and $repoInfo.permissions.admin -eq $true) {
    $hasAdminPermission = $true
  }

  if (-not $hasAdminPermission) {
    Write-Error "Token sem permissao admin no repositorio $Owner/$Repo. Ajuste as permissoes do token (Administration: Read and write) e confirme acesso admin no repositorio."
    exit 1
  }

  Write-Host "Permissao de admin no repositorio confirmada para o usuario/token informado."

  $response = Invoke-GitHubRest -Method "PUT" -Uri $protectionUri -Body $body
  Write-Host "Protecao de branch aplicada com sucesso em $Owner/$Repo ($Branch)."
  Write-Host "Status checks obrigatorios:" ($response.required_status_checks.contexts -join ", ")
  Write-Host "Code owner review obrigatorio:" $response.required_pull_request_reviews.require_code_owner_reviews
} catch {
  $errorMessage = "$($_.Exception.Message)"
  if ($errorMessage -like "*Upgrade to GitHub Pro or make this repository public to enable this feature.*") {
    Write-Error "Falha ao aplicar protecao de branch: o GitHub bloqueou o recurso por plano da conta/repositorio privado. Opcoes: (1) upgrade para GitHub Pro, (2) tornar o repositorio publico, ou (3) manter governanca por CI + templates + CODEOWNERS sem enforce automatico."
    exit 1
  }

  Write-Error "Falha ao aplicar protecao de branch: $($_.Exception.Message)"
  exit 1
}
