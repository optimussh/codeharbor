# CodeHarbor on-prem bootstrap (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "== CodeHarbor on-prem install ==" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example — set GEMINI_API_KEY / CREDENTIALS_MASTER_KEY"
}

Write-Host "npm install..."
npm install

Write-Host "Postgres (pgvector)..."
docker compose up -d postgres

Write-Host "Build server..."
npm run build -w @codeharbor/server

Write-Host @"

Done.
Next:
  1. Edit .env (SESSION_SECRET, CREDENTIALS_MASTER_KEY, GEMINI_API_KEY)
  2. npm run dev:all   # or docker compose -f docker-compose.prod.yml up -d --build
  3. Login http://127.0.0.1:5300/admin as admin
  4. Put model key in Admin → Credentials

Air-gap notes:
  - Pre-load docker images: pgvector/pgvector:pg16, node:22-bookworm-slim, node:22-bookworm
  - Vendor OpenChamber offline (scripts/fetch-openchamber.ps1 on connected machine)
  - Point OPENCODE_BASE_URL at internal OpenCode host
"@
