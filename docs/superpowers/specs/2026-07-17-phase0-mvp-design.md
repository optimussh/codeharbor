# Phase 0 MVP Design — Vibecoding Builder (Catalyst zero-base)

**Date:** 2026-07-17  
**Status:** Approved for implementation planning  
**Source:** `docx/구축스펙.md` (Catalyst open-source stack & rebuild spec)

## 1. Goal

Build a **local-only** MVP that proves the core Catalyst concept:

> Natural language → AI agent (OpenCode) → real files/code in a per-user workspace  
> with chat UX, SSE streaming, permission gates, and simple multi-user auth.

This is **Phase 0** from the rebuild roadmap, plus a thin local auth layer (simplified Phase 1).

### Success criteria (Done)

1. `user1` logs in → chats → files are actually created under their workspace.
2. `user2` cannot access `user1` paths or sessions (403).
3. Dangerous tool actions show a permission card; only **Allow** continues.
4. `admin` can view health, seed users, and audit log tail.
5. Missing `GEMINI_API_KEY` or OpenCode down is visible in UI/health.

## 2. Non-goals (explicit cuts)

| Out of scope for this MVP | Later phase |
|---------------------------|-------------|
| LDAP / SSO | Phase 1 full |
| Docker per-user OS isolation | Phase 2 |
| RAG, doc parser, embeddings | Phase 3 |
| In-house app deploy PaaS | Phase 4 |
| Desktop / VS Code extension | Phase 5 |
| Full terminal (PTY) UI | later |
| Advanced Git / diff viewer | later |
| Admin hijacking other users' live agent sessions | later |

## 3. Architecture

### Approach

**Thin BFF + custom UI** (Track A engine, custom shell):

```
Browser (React :5173)
    │  cookie session, JSON + SSE
    ▼
BFF (Express :3000)
    │  auth, role gate, workspace map, audit
    │  never exposes GEMINI_API_KEY to browser
    ▼
opencode serve (:4096, localhost only)
    │
    ▼
data/workspaces/{username}/
```

### Processes

| Process | Port | Role |
|---------|------|------|
| `apps/web` | 5173 | Login, chat, sessions, permission card, file tree, admin |
| `apps/server` | 3000 | Auth, workspace isolation, OpenCode proxy, SSE relay, audit |
| `opencode serve` | 4096 | Agent engine (sessions, tools, permissions, files) |

### Rules

1. Browser must **not** talk to OpenCode directly.
2. Workspace root per user: `data/workspaces/{username}/`.
3. Gemini key lives only in server/OpenCode environment (`.env`).
4. Path isolation enforced in BFF (`path.resolve` + containment check). OS container isolation is Phase 2.

### Repository layout

```
vibecodingbuilder/
├── apps/
│   ├── web/                 # Vite + React 19 + TS + Tailwind + Zustand
│   └── server/              # Express + cookie session + @opencode-ai/sdk
├── data/
│   ├── workspaces/          # admin/, user1/, user2/  (gitignored)
│   └── audit/               # YYYY-MM-DD.jsonl       (gitignored)
├── docs/superpowers/specs/  # this document
├── docx/구축스펙.md
├── .env.example
├── package.json             # npm workspaces
└── README.md
```

## 4. Auth, roles, data

### Seed accounts

| username | role | password source | workspace |
|----------|------|-----------------|-----------|
| `admin` | `admin` | `ADMIN_PASSWORD` (default `admin123`) | `data/workspaces/admin/` |
| `user1` | `user` | `USER1_PASSWORD` (default `user1`) | `data/workspaces/user1/` |
| `user2` | `user` | `USER2_PASSWORD` (default `user2`) | `data/workspaces/user2/` |

No external DB for MVP. Users are seeded from env/code at boot. Passwords compared with bcrypt (or hashed env values); no plaintext passwords hard-coded in source.

### Session

- HTTP-only cookie session (`express-session` or signed cookie).
- `SESSION_SECRET` from `.env`.
- Local: `SameSite=Lax`, `Secure=false`.
- Logout destroys session.

### Permission matrix

| Action | `user` | `admin` |
|--------|--------|---------|
| Chat / files in own workspace | yes | yes |
| Own OpenCode session CRUD | yes | yes |
| Other users' workspaces / agent sessions | no | **no** (MVP) |
| List seed users | no | yes |
| Health (BFF + OpenCode + LLM configured) | yes (self-facing) | yes |
| Read audit log | no | yes |

### Session ownership map

```
session-map: { [opencodeSessionId]: username }
```

- Written on session create.
- All session APIs require `map[id] === req.user.username` else **403**.
- Admin does **not** open other users' agent sessions in MVP.

### Audit log (`data/audit/YYYY-MM-DD.jsonl`)

Events (metadata only — no prompt body, no API keys):

- `login`, `logout`
- `session.create`, `session.delete`
- `message.send`
- `permission.respond`
- `admin.audit.read`

### Environment (`.env.example`)

```env
GEMINI_API_KEY=

PORT=3000
SESSION_SECRET=change-me
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_BIN=opencode
WORKSPACES_ROOT=./data/workspaces

ADMIN_PASSWORD=admin123
USER1_PASSWORD=user1
USER2_PASSWORD=user2
```

## 5. API and OpenCode integration

### BFF endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/login` | Set session cookie | public |
| POST | `/api/auth/logout` | Clear session | logged-in |
| GET | `/api/auth/me` | `{ username, role }` | logged-in |
| GET | `/api/health` | BFF + OpenCode + LLM status | logged-in |
| GET | `/api/sessions` | List own sessions | logged-in |
| POST | `/api/sessions` | Create session (cwd = own workspace) | logged-in |
| GET | `/api/sessions/:id` | Session detail | owner |
| DELETE | `/api/sessions/:id` | Delete session | owner |
| GET | `/api/sessions/:id/messages` | Message list | owner |
| POST | `/api/sessions/:id/messages` | Send prompt (async preferred) | owner |
| POST | `/api/sessions/:id/abort` | Abort run | owner |
| POST | `/api/sessions/:id/permissions/:permissionId` | Allow / Deny | owner |
| GET | `/api/events` | SSE relay of OpenCode events | logged-in |
| GET | `/api/fs` | Workspace file tree | logged-in |
| GET | `/api/fs/content?path=` | Read file (path-contained) | logged-in |
| GET | `/api/admin/users` | Seed user list | admin |
| GET | `/api/admin/audit` | Audit log tail | admin |

### OpenCode

- Install: `npm i -g opencode-ai` (documented in README; Windows notes).
- Run: BFF spawns `opencode serve --port 4096 --hostname 127.0.0.1` **or** external process via `OPENCODE_BASE_URL`.
- Client: `@opencode-ai/sdk` → `createOpencodeClient({ baseUrl })`.
- LLM: inject Gemini via OpenCode provider auth / config using `GEMINI_API_KEY`.
- Streaming: OpenCode `/event` (SSE) → BFF filters by session ownership → browser `EventSource` on `/api/events`.
- Permissions: OpenCode permission events → UI card → BFF permission response API.

### Command vs stream

- Commands: HTTP POST.
- Tokens / tool progress / permission asks: SSE.
- Reconnect: browser `EventSource` auto-reconnect (MVP); exponential backoff optional polish.

### Health semantics

```json
{
  "server": "ok",
  "opencode": "up" | "down",
  "llm": "configured" | "missing"
}
```

UI shows install/start guidance when `opencode` is down; configure `.env` when `llm` is missing.

### Errors

| Case | Behavior |
|------|----------|
| OpenCode not running | health `down`; chat actions return clear 503 |
| No Gemini key | health `missing`; chat returns clear error |
| Path escape | 403 + audit |
| Foreign session | 403/404 |

## 6. UI

### Screens

| Screen | Purpose |
|--------|---------|
| Login | username / password |
| Chat (main) | session list, stream, composer |
| Permission card | Allow / Deny overlay |
| Files side panel | tree + read-only preview |
| Admin | users, health, audit tail |
| Status bar | OpenCode + LLM indicators |

### Stack

- React 19 + TypeScript + Vite + Tailwind
- Zustand for session/message/connection state
- Dev proxy: `/api` → `http://localhost:3000`

### Entry URL

- Users open **`http://localhost:5173`**
- Do **not** require opening `http://127.0.0.1:4096/` in the browser

## 7. Local runbook

```bash
npm install
cp .env.example .env   # set GEMINI_API_KEY
npm i -g opencode-ai
npm run dev            # server :3000 + web :5173 (+ opencode if managed)
```

## 8. Implementation notes

- Runtime: **Node 24** (Bun not required for MVP).
- Docker available but not required for Phase 0.
- Project git should live under `vibecodingbuilder/` (not the user home git root).
- Prefer small modules: `auth`, `workspace`, `opencode-client`, `sse`, `audit`, `fs`.
- Ensure workspace directories are created on first login/boot.

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| OpenCode API shape changes | Pin SDK version; isolate behind server adapter |
| Windows OpenCode install friction | Document `npm i -g opencode-ai`; health UI guidance |
| Single OpenCode process multi-user race | Session ownership map + cwd per session; true OS isolation later |
| Accidental key leak | Never return env secrets; proxy only |

## 10. Next step

After user review of this spec: invoke **writing-plans** to produce a step-by-step implementation plan, then implement.
