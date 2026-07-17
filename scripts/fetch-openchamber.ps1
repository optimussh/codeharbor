# Fetch pinned OpenChamber into vendor/openchamber
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root "vendor/openchamber"
$shaFile = Join-Path $root "vendor/openchamber.sha"
$repo = "https://github.com/openchamber/openchamber.git"

# Optional pin: set $env:OPENCHAMBER_SHA to lock; empty = latest main tip
$pin = $env:OPENCHAMBER_SHA

if (Test-Path $dest) {
  Write-Host "Updating existing clone at $dest"
  Push-Location $dest
  git fetch --depth 1 origin main
  if ($pin) { git checkout $pin } else { git checkout main; git pull --ff-only origin main }
  $head = git rev-parse HEAD
  Pop-Location
} else {
  New-Item -ItemType Directory -Path (Join-Path $root "vendor") -Force | Out-Null
  if ($pin) {
    git clone --depth 1 $repo $dest
    Push-Location $dest
    git fetch --depth 1 origin $pin
    git checkout $pin
    $head = git rev-parse HEAD
    Pop-Location
  } else {
    git clone --depth 1 --branch main $repo $dest
    Push-Location $dest
    $head = git rev-parse HEAD
    Pop-Location
  }
}

Set-Content -Path $shaFile -Value $head -Encoding utf8
Write-Host "OpenChamber pinned at $head → $shaFile"
Write-Host "Next: cd vendor/openchamber; bun install; bun run dev:web:hmr"
