# CodeHarbor — Security One-Pager

**Product:** CodeHarbor (Governed Vibe Coding Platform)  
**Audience:** InfoSec / IT review  
**Version:** 2026-07-19

---

## 1. What it is

Multi-user **control plane** for AI coding agents on customer infrastructure:

- Browser → **CodeHarbor Gateway (BFF)** → OpenCode agent / models  
- Per-user and per-project workspaces  
- Server-side API keys (never sent to browser)  
- Audit log + usage metering  

---

## 2. Data flow

```
[Developer browser]
        │ HTTPS / cookie session
        ▼
[CodeHarbor Gateway :5300]
  ├─ Auth (local or OIDC)
  ├─ RBAC / project ACL
  ├─ Credential vault (AES-GCM)
  ├─ Audit + usage DB/files
  └─ Proxy /opencode?directory=<allowed>
        │
        ▼
[OpenCode] ──► [Model provider APIs]  (keys from server env/vault only)
        │
        ▼
[Workspace FS: data/workspaces/{user} | data/projects/{id}]
```

Optional: Docker sandbox mounts workspace for untrusted runtimes.

---

## 3. Trust boundaries

| Boundary | Control |
|----------|---------|
| Browser ↔ Gateway | Session cookie, CORS allowlist, rate limits |
| User A ↔ User B | Path isolation, session ownership map, 403 cross-tenant |
| Project members | owner / developer / viewer ACL |
| Model keys | Admin vault only; list API returns last4 never plaintext |
| Agent tools | Permission prompts (OpenCode) + optional sandbox network=none |

---

## 4. Data classes

| Data | Storage | Notes |
|------|---------|-------|
| Source in workspaces | Customer disk/volume | Customer IP |
| Chat/session ids | session-map + OpenCode | Tenant-scoped |
| Audit events | Postgres + files | Admin export; no full prompt body by default |
| Usage metrics | Postgres/files | Estimated cost |
| API keys | Encrypted vault + optional env | Master key in env |

---

## 5. AuthN / AuthZ

- Local accounts (dev/pilot) or **OIDC** (`OIDC_ENABLED`)  
- Roles: `admin`, `user`  
- Project roles: `owner`, `developer`, `viewer`  
- Disabled users rejected at login  

---

## 6. Logging & retention

- Actions: login, bind, message.send, admin.*, project.*, sandbox.*, hooks  
- Export: CSV/JSON admin API  
- Default pilot retention target: **90 days** (configurable ops process)  

---

## 7. Network egress

- Gateway may call model providers (Google/etc.) if keys configured  
- Sandbox default network: **none**  
- On-prem: restrict egress via customer firewall  

---

## 8. Customer responsibilities

1. Rotate `SESSION_SECRET`, `CREDENTIALS_MASTER_KEY`  
2. Protect host Docker socket if sandbox enabled  
3. Classify data allowed in workspaces/prompts  
4. IdP group mapping for admins  

---

## 9. Contact

Security questions: [security@your-company]  
Pilot SoW: `docs/sales/pilot-sow.md`
