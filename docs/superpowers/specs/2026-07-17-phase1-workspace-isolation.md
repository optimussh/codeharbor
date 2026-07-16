# Phase 1 — 인증 · 워크스페이스 격리 (로컬)

**일자:** 2026-07-17  
**상태:** 구현 완료  
**선행:** Phase 0 MVP

## 목표

여러 로컬 계정이 각자 폴더·세션만 쓰도록 격리하고, OpenCode 작업 디렉터리를 유저 워크스페이스에 고정한다.  
(LDAP/NGINX 443은 로컬 범위에서 생략 — 시드 계정 유지)

## 구현 요약

| 항목 | 내용 |
|------|------|
| OpenCode directory | 세션 CRUD/프롬프트/권한 API에 `?directory={workspace}` |
| 세션 소유권 | `data/session-map.json` 영속화 (재시작 복구) |
| 경로 격리 | BFF `resolveWorkspacePath` + 테스트 |
| Admin | `/api/admin/workspaces` 유저별 경로·파일 수·세션 수 |
| UI | 헤더에 워크스페이스 경로, Admin 워크스페이스 표 |

## 비범위 (이후 Phase 2+)

- Docker per-user OS 격리
- LDAP/SSO
- 타 유저 라이브 세션 가로채기
