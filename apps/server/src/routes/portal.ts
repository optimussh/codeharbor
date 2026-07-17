import { Router } from "express";
import { config } from "../config.js";
import { getQuota } from "../quota.js";

export const portalRouter = Router();

portalRouter.get("/", (req, res) => {
  const user = req.session.user;
  const q = user ? getQuota(user.username) : null;
  res.type("html").send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Vibecoding Builder</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0c0d10;color:#e8eaed;margin:0;padding:2rem}
    .wrap{max-width:40rem;margin:0 auto}
    a.card{display:block;border:1px solid #2a2e38;background:#15171c;border-radius:12px;
      padding:1rem 1.2rem;margin:.6rem 0;color:#e8eaed;text-decoration:none}
    a.card:hover{border-color:#7c9cff}
    .muted{color:#9aa0a6;font-size:.9rem}
    code{background:#0a0b0e;padding:.1rem .35rem;border-radius:4px}
    h1{font-size:1.4rem}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Vibecoding Builder</h1>
    <p class="muted">프로덕션급 로컬 플랫폼 · OpenCode + OpenChamber 전환</p>
    ${
      user
        ? `<p>로그인: <strong>${user.username}</strong> (${user.role})
           ${q ? ` · 오늘 메시지 ${q.used}/${q.limit || "∞"}` : ""}</p>
           <form method="post" action="/api/auth/logout" onsubmit="event.preventDefault();fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>location.reload())">
             <button type="submit">Logout</button>
           </form>`
        : `<p class="muted">API 로그인: <code>POST /api/auth/login</code> 또는 레거시 UI 사용</p>`
    }
    <a class="card" href="http://localhost:5173"><strong>레거시 앱 UI</strong><br/><span class="muted">채팅 · 파일 · RAG · 리사이즈 패널 (현재 기본 제품 셸)</span></a>
    <a class="card" href="/chamber"><strong>OpenChamber 셸</strong><br/><span class="muted">${
      config.openchamberEnabled && config.openchamberUrl
        ? "게이트웨이 프록시 연결됨 (로그인 필요)"
        : "업스트림 미연결 — 설정 안내 페이지"
    }</span></a>
    <a class="card" href="/docs/status/index.html"><strong>진행 현황 보드</strong><br/><span class="muted">기능 · 왜 넣었는지 · 다음 방향</span></a>
    <a class="card" href="/api/health"><strong>Health JSON</strong><br/><span class="muted">opencode / llm / rag</span></a>
    <p class="muted">계정: admin/admin123 · user1/user1 · user2/user2</p>
  </div>
</body>
</html>`);
});
