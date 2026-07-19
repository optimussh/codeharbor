# CodeHarbor

**Governed Vibe Coding Platform** · 사내 바이브코딩 플랫폼  
*Vibe coding. Enterprise control.*

| | |
|--|--|
| **Product** | CodeHarbor |
| **Repo / folder** | `codeharbor` |
| **Packages** | `@codeharbor/server`, `@codeharbor/web` |
| **Brand** | [`docs/BRAND.md`](docs/BRAND.md) |
| **Strategy** | [`docs/superpowers/specs/2026-07-19-codeharbor-moat-roadmap.md`](docs/superpowers/specs/2026-07-19-codeharbor-moat-roadmap.md) |

로컬 AI 코딩 에이전트 셸. 자연어 → OpenCode → **유저별 워크스페이스** 산출물.

**포함:** 세션 소유권 영속화, OpenCode `directory` 바인딩, 멀티유저 경로 격리, admin 워크스페이스 요약, RAG 미니 (Postgres+pgvector).

브라우저 진입점(권장): **http://127.0.0.1:5300/**  
Admin: **http://127.0.0.1:5300/admin**  
레거시 채팅 UI: **http://127.0.0.1:5173**

## 사전 요구

- Node.js 20+ (권장 24)
- Gemini API Key ([Google AI Studio](https://aistudio.google.com))
- OpenCode CLI

```bash
npm i -g opencode-ai
```

Windows: 설치 후 **터미널을 새로 열고** `opencode --version` 이 동작하는지 확인.

## 설정

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your-key-here
SESSION_SECRET=any-long-random-string
```

## 실행 (포트 자동 연계)

```bash
npm install
npm run dev:all
```

`dev:all` 이 한 번에 올립니다:

| 서비스 | 포트 | 역할 |
|--------|------|------|
| Postgres (pgvector) | 5433 | RAG |
| Platform gateway | **5300** | 로그인·RAG·테넌트 프록시·포털·Admin |
| OpenCode | **4096** | 에이전트 엔진 |
| OpenChamber | **3001** | IDE UI |
| Legacy Vite UI | **5173** | 채팅/RAG 패널 |

**권장 진입:** http://127.0.0.1:5300/login?next=/chamber  

- 포털/스택: http://127.0.0.1:5300/ · `/api/stack`  
- Admin: http://127.0.0.1:5300/admin  
- 상태 보드: http://127.0.0.1:5300/docs/status/index.html  
- Chamber 프록시: http://127.0.0.1:5300/chamber  
- OpenCode 프록시: `/opencode/*` (로그인 + `directory` 강제)  

### 주요 API (로컬)

| API | 설명 |
|-----|------|
| `POST /api/workspace/bind` | 유저 워크스페이스 준비 + OC 세션 directory 고정 |
| `POST /api/preview/start` | 워크스페이스 앱 미리보기 스폰 |
| `GET /preview/app/` | 미리보기 리버스 프록시 |
| `GET /api/stack` | 포트·서비스 상태 맵 |

### 개별 기동

```powershell
npm run db:up
npm run dev          # platform + legacy only
npm run chamber      # chamber only (waits for :4096)
```

## 테스트 · Gemini 체크

```bash
npm test
npm run e2e:gemini
npm run e2e:gemini:live   # 실제 키 필요
```

## 전략 · P1 · 세일즈 문서

| 문서 | 경로 |
|------|------|
| 브랜드 | `docs/BRAND.md` |
| 해자 · 로드맵 | `docs/superpowers/specs/2026-07-19-codeharbor-moat-roadmap.md` |
| P1 Admin + SSO | `docs/superpowers/specs/2026-07-19-p1-admin-sso.md` |
| P1 Project + Sandbox | `docs/superpowers/specs/2026-07-19-p1-project-sandbox.md` |
| P1 Audit + Usage | `docs/superpowers/specs/2026-07-19-p1-audit-usage.md` |
| 파일럿 SoW | `docs/sales/pilot-sow.md` |
| 15분 데모 스크립트 | `docs/sales/demo-15min.md` |
| 보안 1페이지 | `docs/sales/security-onepager.md` |
| 온프렘 설치 | `npm run install:onprem` · `docker-compose.prod.yml` |
| 진행 보드 | `PROGRESS.md` · `docs/status/index.html` |

로컬 경로: `…/00.ProjectsSRC/codeharbor` (junction) · GitHub: `optimussh/codeharbor`
