# Vibecoding Builder — Phase 0 MVP

로컬 AI 코딩 에이전트 셸. 자연어 → OpenCode → 유저별 워크스페이스 산출물.

브라우저 진입점: **http://localhost:5173**  
(`http://127.0.0.1:4096` 은 OpenCode 백엔드 전용 — 직접 열 필요 없음)

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

`.env` 에 키를 넣습니다.

```env
GEMINI_API_KEY=your-key-here
SESSION_SECRET=any-long-random-string
```

## 실행

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- BFF: http://127.0.0.1:3000  
- OpenCode: http://127.0.0.1:4096 (서버가 `OPENCODE_MANAGED=true` 이면 자동 기동 시도)

## 계정

| username | password  | role  |
|----------|-----------|-------|
| admin    | admin123  | admin |
| user1    | user1     | user  |
| user2    | user2     | user  |

각 유저는 `data/workspaces/{username}/` 만 사용합니다.

## 테스트

```bash
npm test
```

## 구조

```
apps/server  Express BFF (인증, 격리, OpenCode 프록시, SSE)
apps/web     React UI
data/        workspaces + audit (gitignore)
docs/        설계 스펙 · 구현 플랜
```

## 문제 해결

| 증상 | 조치 |
|------|------|
| `ERR_CONNECTION_REFUSED :4096` | OpenCode 미기동. `npm i -g opencode-ai` 후 서버 재시작. UI Status bar 확인 |
| LLM missing | `.env` 에 `GEMINI_API_KEY` 설정 후 재시작 |
| 로그인 실패 | 기본 계정 표 확인. `.env` 의 `*_PASSWORD` 로 변경 가능 |
| 세션/채팅 503 | OpenCode down — health 확인 |

## 스펙

- 설계: `docs/superpowers/specs/2026-07-17-phase0-mvp-design.md`
- 원본 구축스펙: `docx/구축스펙.md`
