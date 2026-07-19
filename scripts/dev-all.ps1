# Full local stack: postgres + platform(:5300, OpenCode:4096) + web(:5173) + chamber(:3001 → OC:4096)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "==> db:up (pgvector :5433)"
docker compose up -d postgres 2>&1 | Out-Host

Write-Host "==> ensuring .env OpenChamber + PORT wiring"
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $root ".env.example") $envPath
}
$c = Get-Content $envPath -Raw
if ($c -notmatch "(?m)^PORT=") {
  $c = "PORT=5300`n" + $c
} elseif ($c -match "(?m)^PORT=3000\s*$") {
  # migrate default off conflict-prone 3000
  $c = $c -replace "(?m)^PORT=3000\s*$", "PORT=5300"
}
if ($c -notmatch "OPENCHAMBER_ENABLED") {
  $c += "`nOPENCHAMBER_ENABLED=true`nOPENCHAMBER_URL=http://127.0.0.1:3001`n"
} else {
  $c = $c -replace "OPENCHAMBER_ENABLED=\w+", "OPENCHAMBER_ENABLED=true"
  if ($c -match "OPENCHAMBER_URL=") {
    $c = $c -replace "OPENCHAMBER_URL=.*", "OPENCHAMBER_URL=http://127.0.0.1:3001"
  } else {
    $c += "`nOPENCHAMBER_URL=http://127.0.0.1:3001`n"
  }
}
Set-Content $envPath $c -NoNewline

Write-Host "==> starting platform + web + chamber (linked ports)"
Write-Host "    platform  http://127.0.0.1:5300"
Write-Host "    admin     http://127.0.0.1:5300/admin"
Write-Host "    chamber   http://127.0.0.1:5300/chamber  → :3001 → OpenCode :4096"
Write-Host "    legacy    http://localhost:5173"
Write-Host "    stack     http://127.0.0.1:5300/api/stack"

npx --yes concurrently -n platform,web,chamber -c blue,green,magenta `
  "npm run dev:server" `
  "npm run dev:web" `
  "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-openchamber.ps1"
