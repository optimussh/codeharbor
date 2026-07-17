import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { ensureWorkspace } from "../workspace.js";
import * as sessionMap from "../sessionMap.js";
import { appendAudit } from "../audit.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";

export const proxyRouter = Router();

function workspaceOf(req: Request): string {
  const username = req.session.user!.username;
  return ensureWorkspace(config.workspacesRoot, username);
}

function requireAuthOrLogin(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    next();
    return;
  }
  const accept = String(req.headers.accept ?? "");
  if (accept.includes("text/html")) {
    const nextPath = req.originalUrl || "/chamber";
    res.redirect(`/login?next=${encodeURIComponent(nextPath)}`);
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

/**
 * Tenant hard-gate for OpenCode HTTP API
 */
proxyRouter.use("/opencode", requireAuth, (req, res, next) => {
  const username = req.session.user!.username;
  const workspace = workspaceOf(req);

  const m = req.path.match(/^\/session\/([^/]+)/);
  if (m) {
    const sid = m[1]!;
    if (sid && sid !== "status") {
      const rec = sessionMap.recordOf(sid);
      if (rec && rec.username !== username) {
        appendAudit("proxy.forbidden", username, { sessionId: sid });
        res.status(403).json({ error: "Forbidden: session not owned" });
        return;
      }
    }
  }

  const url = new URL(req.url, "http://local");
  if (!url.searchParams.has("directory")) {
    url.searchParams.set("directory", workspace);
    req.url = url.pathname + url.search;
  }

  if (
    req.method === "POST" &&
    (req.path === "/session" || req.path === "/session/")
  ) {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        const id =
          body &&
          typeof body === "object" &&
          "id" in body &&
          typeof (body as { id: unknown }).id === "string"
            ? (body as { id: string }).id
            : undefined;
        if (id) {
          sessionMap.claim(id, username, workspace);
          appendAudit("proxy.session.claim", username, { sessionId: id });
        }
      } catch {
        // ignore
      }
      return originalJson(body);
    }) as typeof res.json;
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
      const username = (req as Request).session?.user?.username;
      if (username) {
        const ws = ensureWorkspace(config.workspacesRoot, username);
        const pathWithQuery = proxyReq.path || "/";
        const u = new URL(pathWithQuery, config.opencodeBaseUrl);
        if (!u.searchParams.get("directory")) {
          u.searchParams.set("directory", ws);
          proxyReq.path = u.pathname + u.search;
        }
      }
    },
    proxyRes: (proxyRes, req) => {
      if (
        req.method === "POST" &&
        ((req as Request).path === "/session" ||
          (req as Request).originalUrl?.includes("/opencode/session"))
      ) {
        const chunks: Buffer[] = [];
        const username = (req as Request).session?.user?.username;
        const workspace = username
          ? ensureWorkspace(config.workspacesRoot, username)
          : "";
        proxyRes.on("data", (c: Buffer) => chunks.push(c));
        proxyRes.on("end", () => {
          if (!username || !workspace) return;
          try {
            const text = Buffer.concat(chunks).toString("utf8");
            const body = JSON.parse(text) as { id?: string };
            if (body.id) {
              sessionMap.claim(body.id, username, workspace);
              appendAudit("proxy.session.claim", username, {
                sessionId: body.id,
              });
            }
          } catch {
            // non-json
          }
        });
      }
    },
    error: (err, _req, res) => {
      const r = res as Response;
      if (!r.headersSent) {
        r.status(502).json({
          error: "OpenCode proxy error",
          detail: err.message,
        });
      }
    },
  },
});

proxyRouter.use("/opencode", opencodeProxy);

function rewriteChamberHtml(html: string, chamberOrigin: string): string {
  const inject = `<base href="/chamber/"/>
<script>window.__OPENCHAMBER_API_BASE_URL__=${JSON.stringify(chamberOrigin)};window.__VIBE_PLATFORM__=${JSON.stringify({ gateway: `http://127.0.0.1:${config.port}` })};</script>`;
  let out = html;
  if (out.includes("<head>")) {
    out = out.replace("<head>", `<head>\n    ${inject}\n`);
  } else if (out.includes("<head ")) {
    out = out.replace(/<head([^>]*)>/, `<head$1>\n    ${inject}\n`);
  }
  // Absolute root assets → subpath (keeps double-prefix safe)
  out = out
    .replace(/(href|src)=["']\/(?!chamber\/)/g, `$1="/chamber/`)
    .replace(/url\(\s*\/(?!chamber\/)/g, "url(/chamber/");
  return out;
}

/**
 * Subpath hosting: /chamber/* → OpenChamber :3001/*
 * - HTML rewritten with <base href="/chamber/"> + API base to :3001
 * - Static under /chamber/* proxied
 * - Root /assets|/favicon* also proxied to chamber (SPA absolute paths)
 */
export function mountOpenChamberProxy(app: import("express").Express): void {
  if (!config.openchamberEnabled || !config.openchamberUrl) {
    app.get("/chamber", requireAuthOrLogin, (_req, res) => {
      res.status(503).type("html").send(chamberNotReadyHtml());
    });
    app.get("/chamber/*path", requireAuthOrLogin, (_req, res) => {
      res.status(503).type("html").send(chamberNotReadyHtml());
    });
    return;
  }

  const target = config.openchamberUrl.replace(/\/$/, "");

  // Absolute assets requested at platform origin (when base rewrite incomplete)
  const assetProxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: false,
    on: {
      error: (err, _req, res) => {
        const r = res as Response;
        if (!r.headersSent) r.status(502).end(String(err.message));
      },
    },
  });

  app.use(
    ["/assets", "/favicon.svg", "/favicon-32.png", "/favicon-16.png", "/favicon.png", "/apple-touch-icon.png", "/apple-touch-icon-180x180.png", "/apple-touch-icon-167x167.png", "/apple-touch-icon-152x152.png", "/apple-touch-icon-120x120.png", "/manifest.webmanifest", "/sw.js"],
    (req, res, next) => {
      // only for browser asset GETs
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      assetProxy(req, res, next);
    },
  );

  const chamberProxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    selfHandleResponse: true,
    pathRewrite: { "^/chamber": "" },
    on: {
      proxyRes: responseInterceptor(async (responseBuffer, proxyRes, req) => {
        const ctype = String(proxyRes.headers["content-type"] || "");
        if (ctype.includes("text/html")) {
          const html = responseBuffer.toString("utf8");
          const rewritten = rewriteChamberHtml(html, target);
          return rewritten;
        }
        return responseBuffer;
      }),
      proxyReq: (proxyReq, req) => {
        const username = (req as Request).session?.user?.username;
        if (username) {
          bootstrapUserWorkspace(username);
        }
      },
      error: (err, _req, res) => {
        const r = res as Response;
        if (!r.headersSent) {
          r.status(502)
            .type("html")
            .send(
              `<h1>OpenChamber proxy error</h1><pre>${err.message}</pre>
               <p>Is chamber running on ${target}? <code>npm run chamber</code></p>
               <p><a href="/">Portal</a> · <a href="http://127.0.0.1:5173/">Chat</a></p>`,
            );
        }
      },
    },
  });

  app.use(
    "/chamber",
    requireAuthOrLogin,
    (req: Request, _res: Response, next: NextFunction) => {
      appendAudit("chamber.access", req.session.user?.username, {
        path: req.path,
      });
      if (req.session.user) {
        bootstrapUserWorkspace(req.session.user.username);
      }
      // empty path → index
      if (req.url === "" || req.url === "/") {
        req.url = "/";
      }
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
<p>채팅: <a href="http://127.0.0.1:5173/">http://127.0.0.1:5173/</a></p>
<p>Chamber: <code>npm run chamber</code> 후 <a href="/chamber/">/chamber/</a></p>
<p><a href="/">← 포털</a></p>
</body></html>`;
}
