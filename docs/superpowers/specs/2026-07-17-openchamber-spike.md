# OpenChamber Spike Notes (P0)

**Date:** 2026-07-17  
**Pin:** `3bc8919dbb1b302805979234a6eaad165f9004ef` (main tip at clone time)

## Upstream layout

| Package | Role |
|---------|------|
| `packages/ui` | Shared React UI, sync, OpenCode SDK |
| `packages/web` | Web server + managed OpenCode lifecycle |
| `packages/electron` | Desktop shell |
| `packages/vscode` | Extension |
| `packages/mobile` | Capacitor |

- Package manager: **Bun**
- License: MIT
- Does **not** include multi-tenant auth — we keep gateway for that

## Local fetch

```powershell
pwsh scripts/fetch-openchamber.ps1
cd vendor/openchamber
bun install
```

## Integration decision (go)

1. Keep `apps/server` as **platform gateway** (auth, tenant, RAG, audit).
2. Run / proxy OpenChamber web behind gateway after auth.
3. Force `directory` + session ownership on all OpenCode traffic.
4. Do not commit full `vendor/openchamber` tree (gitignore); pin SHA in `vendor/openchamber.sha`.

## Windows notes

- Bun 1.3.14 installed globally for this machine.
- Full `bun install` **failed** on `sharp` native rebuild (Visual Studio C++ toolchain missing).
- Workaround: `bun install --ignore-scripts` (deps present; sharp optional paths may break).
- Recommended for full OpenChamber: **WSL2 Ubuntu** or install VS Build Tools + “Desktop development with C++”.
- `node-pty` / terminal features may need WSL if native build fails — degrade gracefully.

## Go / no-go

| Item | Result |
|------|--------|
| Clone + pin SHA | **GO** |
| Gateway `/chamber` proxy + auth | **GO** (code path ready) |
| Full Windows native OC install | **NO-GO** without VS Build Tools / WSL |
| Proceed P1–P3 on platform + optional OC | **GO** |
