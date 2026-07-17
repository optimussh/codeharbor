import { Router, type Request, type Response, type NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { ensureWorkspace } from "../workspace.js";
import * as sessionMap from "../sessionMap.js";
import { appendAudit } from "../audit.js";

export const proxyRouter = Router();

function workspaceOf(req: Request): string {
  const username = req.session.user!.username;
  return ensureWorkspace(config.workspacesRoot, username);
}

/**
 * Tenant hard-gate for OpenCode HTTP API:
 * - require login
 * - inject directory=user workspace
 * - block access to sessions not owned by user
 */
proxyRouter.use("/opencode", requireAuth, (req, res, next) => {
  const username = req.session.user!.username;
  const workspace = workspaceOf(req);

  // Ownership check for /session/:id...
  const m = req.path.match(/^\/session\/([^/]+)/);
  if (m) {
    const sid = m[1]!;
    // list/create root is /session without id — path on this mount strips /opencode
    if (sid && sid !== "status") {
      const rec = sessionMap.recordOf(sid);
      if (rec && rec.username !== username) {
        appendAudit("proxy.forbidden", username, { sessionId: sid });
        res.status(403).json({ error: "Forbidden: session not owned" });
        return;
      }
      // claim unknown sessions that resolve under our workspace after create is handled elsewhere
    }
  }

  // Inject directory query
  const url = new URL(req.url, "http://local");
  if (!url.searchParams.has("directory")) {
    url.searchParams.set("directory", workspace);
    req.url = url.pathname + url.search;
  }

  next();
});

const opencodeProxy = createProxyMiddleware({
  target: config.opencodeBaseUrl,
  changeOrigin: true,
  pathRewrite: { "^/opencode": "" },
  ws: true,
  on: {
    proxyReq: (proxyReq, req) => {
      // ensure directory still present after rewrite
      const username = (req as Request).session?.user?.username;
      if (username) {
        const ws = ensureWorkspace(config.workspacesRoot, username);
        const u = new URL(proxyReq.path || "/", config.opencodeBaseUrl);
        if (!u.searchParams.get("directory")) {
          u.searchParams.set("directory", ws);
          proxyReq.path = u.pathname + u.search;
        }
      }
    },
    error: (err, _req, res) => {
      const r = res as Response;
      if (!r.headersSent) {
        r.status(502).json({ error: "OpenCode proxy error", detail: err.message });
      }
    },
  },
});

proxyRouter.use("/opencode", opencodeProxy);

/** Optional reverse proxy to OpenChamber UI/API when OPENCHAMBER_ENABLED=true */
export function mountOpenChamberProxy(app: import("express").Express): void {
  if (!config.openchamberEnabled || !config.openchamberUrl) {
    app.get("/chamber", requireAuth, (_req, res) => {
      res.status(503).type("html").send(chamberNotReadyHtml());
    });
    app.get("/chamber/*path", requireAuth, (_req, res) => {
      res.status(503).type("html").send(chamberNotReadyHtml());
    });
    return;
  }

  const chamberProxy = createProxyMiddleware({
    target: config.openchamberUrl,
    changeOrigin: true,
    ws: true,
    pathRewrite: { "^/chamber": "" },
    on: {
      error: (err, _req, res) => {
        const r = res as Response;
        if (!r.headersSent) {
          r.status(502).type("html").send(
            `<h1>OpenChamber proxy error</h1><pre>${err.message}</pre>`,
          );
        }
      },
    },
  });

  app.use(
    "/chamber",
    requireAuth,
    (req: Request, _res: Response, next: NextFunction) => {
      appendAudit("chamber.access", req.session.user?.username);
      next();
    },
    chamberProxy,
  );
}

function chamberNotReadyHtml(): string {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/><title>OpenChamber</title>
<style>body{font-family:system-ui;background:#0c0d10;color:#e8eaed;padding:2rem;max-width:40rem;margin:auto}
code{background:#15171c;padding:.15rem .4rem;border-radius:4px}a{color:#7c9cff}</style></head>
<body>
<h1>OpenChamber 아직 연결되지 않음</h1>
<p>게이트웨이는 준비됐습니다. 업스트림 OpenChamber를 띄운 뒤 <code>.env</code>에 설정하세요.</p>
<ol>
<li><code>pwsh scripts/fetch-openchamber.ps1</code></li>
<li><code>cd vendor/openchamber &amp;&amp; bun install &amp;&amp; bun run dev:web:hmr</code></li>
<li><code>OPENCHAMBER_ENABLED=true</code> · <code>OPENCHAMBER_URL=http://127.0.0.1:PORT</code></li>
<li>게이트웨이 재시작 후 <a href="/chamber">/chamber</a></li>
</ol>
<p><a href="/">← 포털</a> · <a href="http://localhost:5173">레거시 UI</a></p>
</body></html>`;
}
