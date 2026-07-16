import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { getOpencodeClient, checkOpencodeHealth } from "../opencode/client.js";
import * as sessionMap from "../sessionMap.js";
import { appendAudit } from "../audit.js";
import { config } from "../config.js";
import { ensureWorkspace } from "../workspace.js";

export const sessionsRouter = Router();

async function requireOpencodeUp() {
  const status = await checkOpencodeHealth();
  if (status !== "up") {
    const err = new Error("OpenCode is down") as Error & { status: number };
    err.status = 503;
    throw err;
  }
}

function sessionIdOf(s: unknown): string | undefined {
  if (!s || typeof s !== "object") return undefined;
  const o = s as Record<string, unknown>;
  if (typeof o.id === "string") return o.id;
  if (typeof o.sessionID === "string") return o.sessionID;
  return undefined;
}

sessionsRouter.get("/sessions", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const client = getOpencodeClient();
    const listed = await client.session.list();
    const all = (listed as { data?: unknown }).data ?? listed;
    const arr = Array.isArray(all) ? all : [];
    const owned = arr.filter((s) => {
      const id = sessionIdOf(s);
      return id && sessionMap.assertOwner(id, username);
    });
    // Also include map-only ids not returned yet
    res.json(owned);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.post("/sessions", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const workspace = ensureWorkspace(config.workspacesRoot, username);
    const client = getOpencodeClient();
    const title =
      typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim()
        : `session-${username}-${Date.now()}`;

    const created = await client.session.create({
      body: { title },
    });
    const data = (created as { data?: unknown }).data ?? created;
    const id = sessionIdOf(data);
    if (!id) {
      res.status(502).json({ error: "OpenCode create returned no session id", raw: data });
      return;
    }
    sessionMap.claim(id, username);
    appendAudit("session.create", username, { sessionId: id, workspace });

    // Best-effort: some OpenCode versions accept directory in update / path APIs
    try {
      await fetch(`${config.opencodeBaseUrl}/session/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, directory: workspace }),
      });
    } catch {
      // ignore
    }

    res.status(201).json(data);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.get("/sessions/:id", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const id = req.params.id;
    if (!sessionMap.assertOwner(id, username)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const client = getOpencodeClient();
    const result = await client.session.get({ path: { id } });
    res.json((result as { data?: unknown }).data ?? result);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.delete("/sessions/:id", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const id = req.params.id;
    if (!sessionMap.assertOwner(id, username)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const client = getOpencodeClient();
    await client.session.delete({ path: { id } });
    sessionMap.release(id);
    appendAudit("session.delete", username, { sessionId: id });
    res.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.get("/sessions/:id/messages", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const id = req.params.id;
    if (!sessionMap.assertOwner(id, username)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const client = getOpencodeClient();
    const result = await client.session.messages({ path: { id } });
    res.json((result as { data?: unknown }).data ?? result);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.post("/sessions/:id/messages", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const id = req.params.id;
    if (!sessionMap.assertOwner(id, username)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    appendAudit("message.send", username, { sessionId: id });

    // Prefer async so SSE can stream; fall back to sync prompt
    const asyncRes = await fetch(
      `${config.opencodeBaseUrl}/session/${id}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parts: [{ type: "text", text }],
          ...(config.geminiApiKey
            ? {
                model: {
                  providerID: "google",
                  modelID: "gemini-2.0-flash",
                },
              }
            : {}),
        }),
      },
    );

    if (asyncRes.status === 204 || asyncRes.ok) {
      res.status(202).json({ ok: true, mode: "async" });
      return;
    }

    const client = getOpencodeClient();
    const result = await client.session.prompt({
      path: { id },
      body: {
        parts: [{ type: "text", text }],
      },
    });
    res.json((result as { data?: unknown }).data ?? result);
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.post("/sessions/:id/abort", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const id = req.params.id;
    if (!sessionMap.assertOwner(id, username)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const client = getOpencodeClient();
    await client.session.abort({ path: { id } });
    res.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 502).json({ error: err.message });
  }
});

sessionsRouter.post(
  "/sessions/:id/permissions/:permissionId",
  requireAuth,
  async (req, res) => {
    try {
      await requireOpencodeUp();
      const username = req.session.user!.username;
      const id = req.params.id;
      const permissionId = req.params.permissionId;
      if (!sessionMap.assertOwner(id, username)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const response = String(req.body?.response ?? "reject");
      const allowed = ["once", "always", "reject"];
      if (!allowed.includes(response)) {
        res.status(400).json({ error: "response must be once|always|reject" });
        return;
      }

      const r = await fetch(
        `${config.opencodeBaseUrl}/session/${id}/permissions/${permissionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response }),
        },
      );

      appendAudit("permission.respond", username, {
        sessionId: id,
        permissionId,
        response,
      });

      if (!r.ok) {
        const body = await r.text();
        res.status(502).json({ error: "permission respond failed", detail: body });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 502).json({ error: err.message });
    }
  },
);
