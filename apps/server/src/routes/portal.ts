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
    .wrap{max-width:44rem;margin:0 auto}
    a.card,button.card{display:block;width:100%;text-align:left;border:1px solid #2a2e38;background:#15171c;border-radius:12px;
      padding:1rem 1.2rem;margin:.6rem 0;color:#e8eaed;text-decoration:none;cursor:pointer;font:inherit}
    a.card:hover,button.card:hover{border-color:#7c9cff}
    .muted{color:#9aa0a6;font-size:.9rem}
    code{background:#0a0b0e;padding:.1rem .35rem;border-radius:4px}
    h1{font-size:1.4rem}
    .dot{display:inline-block;width:.55rem;height:.55rem;border-radius:50%;margin-right:.35rem}
    .up{background:#3dd68c}.down{background:#f87171}.unk{background:#6b7280}
    #stack,#preview{font-family:ui-monospace,Consolas,monospace;font-size:.78rem;color:#9aa0a6;
      background:#0a0b0e;border-radius:8px;padding:.75rem;margin:1rem 0;white-space:pre-wrap}
    button.sm{background:#2a2e38;border:0;color:#e8eaed;padding:.4rem .7rem;border-radius:6px;cursor:pointer;margin-right:.35rem}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Vibecoding Builder</h1>
    <p class="muted">로컬 풀스택 · :3000 게이트웨이 · :4096 OpenCode · :3001 Chamber · :5173 채팅</p>
    ${
      user
        ? `<p>로그인: <strong>${user.username}</strong> (${user.role})
           ${q ? ` · 메시지 ${q.used}/${q.limit || "∞"}` : ""}
           <button class="sm" onclick="fetch('/api/auth/logout',{method:'POST',credentials:'include'}).then(()=>location.reload())">Logout</button></p>`
        : `<p class="muted"><a href="/login?next=/">로그인</a> · admin / user1 / user2</p>`
    }
    <div id="stack">스택 로딩…</div>

    <a class="card" href="http://127.0.0.1:5173/"><strong>1. 채팅 UI</strong><br/>
      <span class="muted">세션 · 메시지 · RAG · 파일 트리 — 가장 확실한 채팅</span></a>
    <a class="card" href="/chamber/"><strong>2. OpenChamber IDE (서브패스)</strong><br/>
      <span class="muted">http://127.0.0.1:3000/chamber/ · SPA 자산 프록시 · API는 :3001</span></a>
    <button class="card" type="button" id="btnPreview"><strong>3. 앱 미리보기 시작</strong><br/>
      <span class="muted">워크스페이스에서 dev 서버 스폰 → /preview/app/</span></button>
    <div id="preview">preview: idle</div>
    <a class="card" href="/docs/status/index.html"><strong>진행 현황 보드</strong></a>
    <a class="card" href="/api/stack"><strong>Stack JSON</strong></a>
    <p class="muted">기동: <code>npm run dev:all</code></p>
  </div>
  <script>
    async function refreshStack() {
      try {
        const s = await fetch('/api/stack').then(r => r.json());
        const svc = s.services || {};
        const line = (name, st) => {
          const cls = st === 'up' || st === 'configured' || st === 'enabled' ? 'up'
            : st === 'missing' || st === 'disabled' ? 'unk' : 'down';
          return '<div><span class="dot ' + cls + '"></span>' + name + ': ' + st + '</div>';
        };
        document.getElementById('stack').innerHTML =
          Object.entries(svc).map(([k,v]) => line(k, v)).join('') +
          '\\n' + JSON.stringify(s.ports);
      } catch (e) {
        document.getElementById('stack').textContent = 'stack failed: ' + e;
      }
    }
    async function refreshPreview() {
      try {
        const p = await fetch('/api/preview', { credentials: 'include' }).then(r => r.json());
        document.getElementById('preview').textContent = p.running
          ? 'running port=' + p.port + ' → ' + p.url + ' | direct ' + p.direct
          : 'preview: idle (로그인 후 시작)';
      } catch {
        document.getElementById('preview').textContent = 'preview: login required';
      }
    }
    document.getElementById('btnPreview').onclick = async () => {
      const r = await fetch('/api/preview/start', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}'
      });
      const data = await r.json();
      if (!r.ok) { alert(data.error || 'preview failed'); return; }
      await refreshPreview();
      window.open(data.url || '/preview/app/', '_blank');
    };
    refreshStack();
    refreshPreview();
  </script>
</body>
</html>`);
});
