param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('staging', 'prod')]
  [string]$Env
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$ignorePath = Join-Path $repoRoot '.claspignore'

$targets = @{
  staging = @{
    User = 'chvrent18'
    Project = Join-Path $repoRoot '.clasp.staging.json'
    DeploymentId = 'AKfycbwBER-C0zjRd1piXcqvC-LHNFYP-b9zBitXxAsoaCfeJgWFjf7uxktzjdzpun3PIzdz'
  }
  prod = @{
    User = 'ayana.yokoo'
    Project = Join-Path $repoRoot '.clasp.prod.json'
    DeploymentId = 'AKfycbzfuyTAe_ZUsCutzU5H1UkQZVoq2zOrmn1WoP4j9tiEYBo5BDNzPW6kofDGXkTiDAJ0Qw'
  }
}

$target = $targets[$Env]

if (-not (Test-Path -LiteralPath $target.Project)) {
  throw "Missing clasp project file: $($target.Project)"
}

if (-not (Test-Path -LiteralPath $ignorePath)) {
  throw "Missing clasp ignore file: $ignorePath"
}

Set-Location -LiteralPath $repoRoot

function Invoke-ClaspChecked {
  param(
    [string[]]$Arguments
  )

  & clasp @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "clasp failed with exit code $($LASTEXITCODE): $($Arguments -join ' ')"
  }
}

Write-Host "Deploy target: $Env"
Write-Host "clasp user: $($target.User)"
Write-Host "project file: $($target.Project)"
Write-Host "deployment id: $($target.DeploymentId)"

Invoke-ClaspChecked -Arguments @('--user', $target.User, '-P', $target.Project, '-I', $ignorePath, 'status')
Invoke-ClaspChecked -Arguments @('--user', $target.User, '-P', $target.Project, '-I', $ignorePath, 'push')
Invoke-ClaspChecked -Arguments @('--user', $target.User, '-P', $target.Project, '-I', $ignorePath, 'deploy', '-i', $target.DeploymentId)
