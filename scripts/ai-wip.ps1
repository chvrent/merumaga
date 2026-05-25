param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Codex', 'Claude', 'Gemini', 'Antigravity')]
  [string]$Agent,

  [string]$Message = 'handoff'
)

$ErrorActionPreference = 'Stop'

$repoRoot = 'C:\Users\ayana.yokoo\Desktop\mail-magazine-maker'
$currentPath = (Get-Location).Path
if ($currentPath -ne $repoRoot) {
  throw "Wrong working directory: $currentPath. Use $repoRoot."
}

$prefixMap = @{
  Codex = 'codex'
  Claude = 'claude'
  Gemini = 'gemini'
  Antigravity = 'antigravity'
}

$prefix = $prefixMap[$Agent]
$branch = (git branch --show-current).Trim()
if ($branch -notlike "$prefix/*") {
  throw "$Agent must create WIP commits only on $prefix/* branches. Current branch: $branch"
}

$status = git status --short
if (-not $status) {
  Write-Host 'No changes to commit.'
  exit 0
}

git add -A
git commit -m "wip($prefix): $Message"
Write-Host "WIP commit created on $branch"

