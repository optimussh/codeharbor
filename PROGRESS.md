# Progress

프로젝트 진행 현황 로그. 커밋 직전 갱신 (`claude_Template-main/rules/common/git.md`).

사람용 요약 보드: [`docs/status/index.html`](docs/status/index.html)

---

## 2026-07-17

### P0–P3 배치 (OpenChamber 프로덕션 전환)

#### P0 — 문서 · 원격 · 스파이크

- **What:** `PROGRESS.md`, `docs/status/index.html`, `scripts/fetch-openchamber.ps1`, `vendor/PIN.md` + SHA pin, OpenChamber shallow clone.
- **Why:** 진행 추적·재현 가능한 벤더 핀·GitHub 푸시 기반.
- **Spike:** OpenChamber pin `3bc8919…` · Windows `bun install`은 sharp/node-gyp(VS C++)로 실패 → `--ignore-scripts` 또는 WSL 권장.
- **Status:** done

#### P1 — 게이트웨이 포털 · Chamber 프록시 골격

- **What:** `/` 포털, `/chamber` (auth + reverse proxy 또는 설정 안내), `/docs/status` 정적 서빙.
- **Why:** 단일 진입점 + OpenChamber 연결 자리 확보 (업스트림 기동 시 스위치).
- **Status:** done (코드) · OC UI 실기동은 Windows 네이티브 제약 시 WSL

#### P2 — Tenant hard gate 프록시

- **What:** `/opencode/*` 인증 필수, `directory` 주입, 타인 세션 403, audit.
- **Why:** 브라우저→OpenCode 직행 차단·격리 강제.
- **Status:** done

#### P3 — 쿼터 · 문서 · 하드닝 1차

- **What:** 일일 메시지 쿼터 (`data/quota.json`, `GET /api/quota`), 채팅 429, 상태 보드 갱신.
- **Why:** 거버넌스 미니 + 프로덕션 로컬 1.0 체크리스트.
- **Status:** done (로컬 1.0 플랫폼 측)

### 이전 완료 (MVP)

| 커밋 | 내용 |
|------|------|
| `14d7b3d` | 패널 리사이즈 UX |
| `9ed8d18` | Phase 3 RAG 미니 |
| `9598fef` | Phase 1 workspace 격리 |
| `96a7cab` | Phase 0 BFF + UI + OpenCode |
