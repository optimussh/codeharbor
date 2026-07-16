# Phase 3 RAG 미니 (로컬)

**일자:** 2026-07-17  
**상태:** 구현 완료

## 범위

| 포함 | 제외(스킵) |
|------|------------|
| Docker Postgres + pgvector | BGE-M3 로컬 가중치 |
| 청킹 1200/150 | 재랭커 |
| Gemini embed 또는 local hash 폴백 | LibreOffice / OCR / vLLM |
| 유저별 documents/chunks | RLS 고급 정책 (앱 레벨 username 필터) |
| 업로드·검색 API + UI | Agentic RAG MCP |
| 채팅 시 컨텍스트 주입 | PDF 바이너리 파서 |

## API

- `GET /api/rag/status`
- `GET /api/rag/documents`
- `POST /api/rag/documents` (multipart `file` 또는 JSON text)
- `DELETE /api/rag/documents/:id`
- `POST /api/rag/search` `{ query, topK? }`

## 기동

```bash
npm run db:up
npm run dev
```
