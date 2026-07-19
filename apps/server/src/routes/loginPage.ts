import { Router } from "express";

export const loginPageRouter = Router();

loginPageRouter.get("/login", (req, res) => {
  if (req.session.user) {
    const next = String(req.query.next ?? "/");
    res.redirect(next.startsWith("/") ? next : "/");
    return;
  }
  const next = String(req.query.next ?? "/");
  const err = String(req.query.error ?? "");
  res.type("html").send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Login · CodeHarbor</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0c0d10;color:#e8eaed;margin:0;
      min-height:100vh;display:flex;align-items:center;justify-content:center}
    form{width:100%;max-width:22rem;background:#15171c;border:1px solid #2a2e38;
      border-radius:14px;padding:1.5rem}
    h1{font-size:1.15rem;margin:0 0 .25rem}
    p{color:#9aa0a6;font-size:.85rem;margin:0 0 1rem}
    label{display:block;font-size:.75rem;color:#9aa0a6;margin:.6rem 0 .25rem}
    input{width:100%;box-sizing:border-box;padding:.55rem .7rem;border-radius:8px;
      border:1px solid #2a2e38;background:#0a0b0e;color:#e8eaed}
    button{margin-top:1rem;width:100%;padding:.65rem;border:0;border-radius:8px;
      background:#4f6ef7;color:#fff;font-weight:600;cursor:pointer}
    button:hover{background:#3d5bd9}
    .err{color:#f87171;font-size:.85rem;margin-top:.75rem}
    .hint{font-size:.7rem;color:#6b7280;margin-top:1rem}
    a{color:#7c9cff}
  </style>
</head>
<body>
  <form id="f">
    <h1>CodeHarbor</h1>
    <p>사내 바이브코딩 플랫폼 · 로그인 후 목적지로 이동합니다</p>
    <label>Username</label>
    <input name="username" id="u" value="user1" autocomplete="username" required />
    <label>Password</label>
    <input name="password" id="p" type="password" value="user1" autocomplete="current-password" required />
    <button type="submit">Login</button>
    <div class="err" id="e">${err ? "로그인 실패" : ""}</div>
    <p class="hint" style="margin-top:.75rem"><a href="/api/auth/oidc/login?next=${encodeURIComponent(next)}">Login with SSO (OIDC)</a>
      <span style="opacity:.7"> — OIDC_ENABLED=true 일 때</span></p>
    <p class="hint">admin/admin123 · user1/user1 · user2/user2</p>
    <p class="hint">채팅 UI: <a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a><br/>
    Admin: <a href="/admin">/admin</a> · Chamber: <a href="/chamber/">/chamber/</a></p>
  </form>
  <script>
    const next = ${JSON.stringify(next)};
    document.getElementById('f').onsubmit = async (ev) => {
      ev.preventDefault();
      const username = document.getElementById('u').value;
      const password = document.getElementById('p').value;
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!r.ok) {
        document.getElementById('e').textContent = '로그인 실패';
        return;
      }
      location.href = next.startsWith('/') ? next : '/';
    };
  </script>
</body>
</html>`);
});
