param(
  [switch]$Staged
)

$ErrorActionPreference = 'Stop'

$diffArgs = @('diff', '--name-only')
if ($Staged) {
  $diffArgs = @('diff', '--cached', '--name-only')
}

$changed = & git @diffArgs
if ($LASTEXITCODE -ne 0) {
  throw 'git diff failed'
}

$codePattern = '\.(gs|html|js|css|json|ps1)$'
$docPattern = '^(SPEC\.md|SPEC_SUMMARY\.md|ANTIGRAVITY\.md|START_HERE\.md|運用台帳\.md|docs/)'

$codeChanged = @($changed | Where-Object { $_ -match $codePattern -and $_ -notmatch '^scripts/check-documentation-update\.ps1$' })
$docsChanged = @($changed | Where-Object { $_ -match $docPattern })

if ($codeChanged.Count -gt 0 -and $docsChanged.Count -eq 0) {
  Write-Error 'Code changed but no project documentation/ledger file changed. Update SPEC.md, SPEC_SUMMARY.md, ANTIGRAVITY.md, START_HERE.md, docs/*, or 運用台帳.md before finishing.'
}

Write-Host 'documentation update check OK'