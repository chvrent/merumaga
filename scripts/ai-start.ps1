param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Codex', 'Claude', 'Gemini', 'Antigravity')]
  [string]$Agent,

  [string]$Task = 'work',

  [switch]$AllowOtherAgentBranch
)

$ErrorActionPreference = 'Stop'

$repoRoot = 'C:\Users\ayana.yokoo\Desktop\mail-magazine-maker'
$currentPath = (Get-Location).Path
if ($currentPath -ne $repoRoot) {
  throw "Wrong working directory: $currentPath. Use $repoRoot."
}

git rev-parse --is-inside-work-tree | Out-Null

$prefixMap = @{
  Codex = 'codex'
  Claude = 'claude'
  Gemini = 'gemini'
  Antigravity = 'antigravity'
}

$prefix = $prefixMap[$Agent]
$knownPrefixes = @('codex', 'claude', 'gemini', 'antigravity')

function ConvertTo-BranchSlug([string]$value) {
  $slug = $value.ToLowerInvariant()
  $slug = $slug -replace '[^a-z0-9._-]+', '-'
  $slug = $slug.Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return 'work'
  }
  return $slug
}

$branch = (git branch --show-current).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) {
  throw 'Detached HEAD. Stop and ask the user before editing.'
}

$status = git status --short

if ($branch -like "$prefix/*") {
  Write-Host "Already on $Agent branch: $branch"
  if ($status) {
    Write-Host 'Uncommitted changes exist. Read them before editing.'
  }
  exit 0
}

$isOtherAgentBranch = $false
foreach ($knownPrefix in $knownPrefixes) {
  if ($branch -like "$knownPrefix/*" -and $knownPrefix -ne $prefix) {
    $isOtherAgentBranch = $true
    break
  }
}

if ($isOtherAgentBranch -and -not $AllowOtherAgentBranch) {
  throw "Current branch '$branch' belongs to another AI. Ask the user before continuing, or rerun with -AllowOtherAgentBranch."
}

$slug = ConvertTo-BranchSlug $Task
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$newBranch = "$prefix/$slug-$timestamp"

git switch -c $newBranch | Out-Host
Write-Host "Created and switched to $newBranch"

if ($status) {
  Write-Host 'Existing uncommitted changes moved with the working tree. Treat them as inherited work and inspect before editing.'
}

