# Run AFTER closing IDE/agent terminals that lock this folder.
# Renames:  ...\vibecodingbuilder  →  ...\codeharbor
$ErrorActionPreference = "Stop"
$parent = Split-Path -Parent $PSScriptRoot
$leaf = Split-Path -Leaf $parent
$grand = Split-Path -Parent $parent
$src = $parent
$dst = Join-Path $grand "codeharbor"

if ($leaf -eq "codeharbor") {
  Write-Host "Already named codeharbor: $src"
  exit 0
}
if ($leaf -ne "vibecodingbuilder") {
  Write-Host "Unexpected folder name '$leaf'. Expected vibecodingbuilder under ProjectsSRC."
  exit 1
}
if (Test-Path $dst) {
  Write-Host "Target already exists: $dst"
  exit 1
}

Write-Host "Rename:`n  $src`n→ $dst"
Rename-Item -LiteralPath $src -NewName "codeharbor"
Write-Host "OK. Re-open workspace at: $dst"
Write-Host "Optional: git remote set-url origin https://github.com/optimussh/codeharbor.git"
