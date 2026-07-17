# Vendor pins

## openchamber

| 항목 | 값 |
|------|-----|
| Upstream | https://github.com/openchamber/openchamber |
| License | MIT |
| Local path | `vendor/openchamber` (gitignored clone; fetch script로 재현) |
| Package manager | Bun ≥ 1.3 |

### Fetch

```powershell
pwsh scripts/fetch-openchamber.ps1
```

Pin SHA is written to `vendor/openchamber.sha` after fetch.
