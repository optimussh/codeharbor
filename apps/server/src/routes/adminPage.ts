import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

export const adminPageRouter = Router();

function requireAdminHtml(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    res.redirect("/login?next=/admin");
    return;
  }
  if (req.session.user.role !== "admin") {
    res.status(403).type("html").send("<h1>Forbidden</h1><p>Admin only</p>");
    return;
  }
  next();
}

adminPageRouter.get("/admin", requireAdminHtml, (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>CodeHarbor Admin</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0c0d10;color:#e8eaed;margin:0;padding:1.5rem}
    .wrap{max-width:960px;margin:0 auto}
    h1{font-size:1.35rem;margin:0 0 .25rem}
    .muted{color:#9aa0a6;font-size:.9rem}
    a{color:#7c9cff}
    section{background:#15171c;border:1px solid #2a2e38;border-radius:12px;padding:1rem;margin:1rem 0}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    th,td{text-align:left;padding:.4rem .35rem;border-bottom:1px solid #2a2e38}
    input,select,button,textarea{background:#0a0b0e;border:1px solid #2a2e38;color:#e8eaed;border-radius:6px;padding:.4rem .55rem;font:inherit}
    button{background:#4f6ef7;border:0;cursor:pointer;font-weight:600}
    button.secondary{background:#2a2e38}
    .row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.5rem 0}
    pre{background:#0a0b0e;padding:.75rem;border-radius:8px;overflow:auto;font-size:.75rem;max-height:240px}
    .tabs button{margin-right:.35rem}
    .tabs button.active{outline:1px solid #7c9cff}
  </style>
</head>
<body>
<div class="wrap">
  <h1>CodeHarbor Admin</h1>
  <p class="muted">Governed vibe coding · <a href="/">Portal</a> · <a href="/docs/status/index.html">Status</a></p>
  <div class="tabs row">
    <button type="button" data-tab="users" class="active">Users</button>
    <button type="button" data-tab="creds" class="secondary">Credentials</button>
    <button type="button" data-tab="audit" class="secondary">Audit</button>
    <button type="button" data-tab="usage" class="secondary">Usage</button>
    <button type="button" data-tab="settings" class="secondary">Settings</button>
  </div>

  <section id="panel-users">
    <h2>Users</h2>
    <div id="users"></div>
    <div class="row">
      <input id="nu" placeholder="username"/>
      <input id="np" placeholder="password" type="password"/>
      <select id="nr"><option value="user">user</option><option value="admin">admin</option></select>
      <button type="button" id="btnCreate">Create</button>
    </div>
  </section>

  <section id="panel-creds" hidden>
    <h2>API credentials (server vault)</h2>
    <p class="muted">Plaintext keys are never listed. Browser never receives secrets.</p>
    <div id="creds"></div>
    <div class="row">
      <select id="prov"><option value="google">google (Gemini)</option><option value="openai">openai</option><option value="anthropic">anthropic</option></select>
      <input id="apikey" type="password" placeholder="API key" style="min-width:16rem"/>
      <button type="button" id="btnCred">Save key</button>
    </div>
  </section>

  <section id="panel-audit" hidden>
    <h2>Audit</h2>
    <div class="row">
      <input id="aUser" placeholder="user filter"/>
      <input id="aAction" placeholder="action filter"/>
      <button type="button" id="btnAudit">Refresh</button>
      <a class="muted" id="auditCsv" href="/api/admin/audit/export?format=csv">Export CSV</a>
    </div>
    <pre id="audit"></pre>
  </section>

  <section id="panel-usage" hidden>
    <h2>Usage / est. cost</h2>
    <div class="row">
      <button type="button" id="btnUsage">Refresh</button>
      <a class="muted" href="/api/admin/usage/export">Export CSV</a>
    </div>
    <pre id="usage"></pre>
  </section>

  <section id="panel-settings" hidden>
    <h2>Settings</h2>
    <pre id="settings"></pre>
  </section>
</div>
<script>
const $ = (id) => document.getElementById(id);
async function api(path, opts) {
  const r = await fetch(path, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...(opts && opts.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
function showTab(name) {
  for (const p of ['users','creds','audit','usage','settings']) {
    $('panel-' + p).hidden = p !== name;
  }
  document.querySelectorAll('.tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
    b.classList.toggle('secondary', b.dataset.tab !== name);
  });
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

async function loadUsers() {
  const { users } = await api('/api/admin/users');
  $('users').innerHTML = '<table><tr><th>User</th><th>Role</th><th>Disabled</th><th>Quota</th><th></th></tr>' +
    users.map(u => '<tr><td>' + u.username + '</td><td>' + u.role +
      '</td><td>' + (u.disabled ? 'yes' : 'no') +
      '</td><td>' + (u.dailyQuota ?? 'default') +
      '</td><td><button type="button" data-toggle="' + u.username + '" class="secondary">' +
      (u.disabled ? 'Enable' : 'Disable') + '</button></td></tr>').join('') + '</table>';
  $('users').querySelectorAll('[data-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const username = btn.getAttribute('data-toggle');
      const u = users.find(x => x.username === username);
      await api('/api/admin/users/' + encodeURIComponent(username), {
        method: 'PATCH', body: JSON.stringify({ disabled: !u.disabled })
      });
      loadUsers();
    };
  });
}
$('btnCreate').onclick = async () => {
  await api('/api/admin/users', { method: 'POST', body: JSON.stringify({
    username: $('nu').value, password: $('np').value, role: $('nr').value
  })});
  $('nu').value = ''; $('np').value = '';
  loadUsers();
};

async function loadCreds() {
  const { credentials } = await api('/api/admin/credentials');
  $('creds').innerHTML = credentials.length
    ? '<table><tr><th>Provider</th><th>Last4</th><th>Updated</th></tr>' +
      credentials.map(c => '<tr><td>' + c.provider + '</td><td>…' + c.last4 +
        '</td><td>' + (c.updatedAt || '') + '</td></tr>').join('') + '</table>'
    : '<p class="muted">No vault credentials yet (env GEMINI_API_KEY may still apply).</p>';
}
$('btnCred').onclick = async () => {
  await api('/api/admin/credentials/' + encodeURIComponent($('prov').value), {
    method: 'PUT', body: JSON.stringify({ apiKey: $('apikey').value })
  });
  $('apikey').value = '';
  loadCreds();
  alert('Saved (server-side only)');
};

async function loadAudit() {
  const q = new URLSearchParams();
  if ($('aUser').value) q.set('user', $('aUser').value);
  if ($('aAction').value) q.set('action', $('aAction').value);
  q.set('limit', '80');
  const { events } = await api('/api/admin/audit?' + q);
  $('audit').textContent = JSON.stringify(events, null, 2);
  $('auditCsv').href = '/api/admin/audit/export?format=csv&' + q.toString();
}
$('btnAudit').onclick = () => loadAudit();

async function loadUsage() {
  const data = await api('/api/admin/usage');
  $('usage').textContent = JSON.stringify(data, null, 2);
}
$('btnUsage').onclick = () => loadUsage();

async function loadSettings() {
  $('settings').textContent = JSON.stringify(await api('/api/admin/settings'), null, 2);
}

loadUsers(); loadCreds(); loadSettings();
</script>
</body>
</html>`);
});
