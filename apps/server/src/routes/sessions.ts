import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { checkOpencodeHealth } from "../opencode/client.js";
import {
  opencodeFetch,
  opencodeUrl,
  parseJsonBody,
  sessionIdOf,
  directoryOf,
} from "../opencode/http.js";
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

function workspaceOf(username: string): string {
  return ensureWorkspace(config.workspacesRoot, username);
}

function requireSessionOwner(
  id: string,
  username: string,
): sessionMap.SessionRecord {
  if (!sessionMap.assertOwner(id, username)) {
    const err = new Error("Forbidden") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return sessionMap.recordOf(id)!;
}

sessionsRouter.get("/sessions", requireAuth, async (req, res) => {
  try {
    await requireOpencodeUp();
    const username = req.session.user!.username;
    const workspace = workspaceOf(username);

    // List sessions scoped to this user's workspace directory
    const listed = await opencodeFetch("/session", {
      directory: workspace,
      method: "GET",
    });
    const body = await parseJsonBody(listed);
    const arr = Array.isArray(body) ? body : [];

    const owned = arr.filter((s) => {
      const id = sessionIdOf(s);
      if (!id) return false;
      // Prefer ownership map; also accept sessions in our directory not yet mapped
      if (sessionMap.assertOwner(id, username)) return true;
      const dir = directoryOf(s);
      if (dir && pathEquals(dir, workspace)) {
        sessionMap.claim(id, username, workspace);
        return true;
      }
      return false;
    });

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
    const workspace = workspaceOf(username);
    const title =
      typeof req.body?.title === "string" && req.body.title.trim()
        ? req.body.title.trim()
        : `session-${username}-${Date.now()}`;

    const created = await opencodeFetch("/session", {
      method: "POST",
      directory: workspace,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!created.ok) {
      const detail = await created.text();
      res.status(502).json({
        error: "OpenCode session create failed",
        detail,
        directory: workspace,
      });
      return;
    }

    const data = await parseJsonBody(created);
    const id = sessionIdOf(data);
    if (!id) {
      res
        .status(502)
        .json({ error: "OpenCode create returned no session id", raw: data });
      return;
    }

    sessionMap.claim(id, username, workspace);
    appendAudit("session.create", username, {
      sessionId: id,
      workspace,
      directory: directoryOf(data) ?? workspace,
    });

    res.status(201).json({
      ...(typeof data === "object" && data ? data : { id }),
      workspace,
    });
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
    const rec = requireSessionOwner(id, username);

    const result = await opencodeFetch(`/session/${id}`, {
      method: "GET",
      directory: rec.workspace,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: await result.text() });
      return;
    }
    res.json(await parseJsonBody(result));
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
    const rec = requireSessionOwner(id, username);

    const result = await opencodeFetch(`/session/${id}`, {
      method: "DELETE",
      directory: rec.workspace,
    });
    sessionMap.release(id);
    appendAudit("session.delete", username, { sessionId: id });
    if (!result.ok && result.status !== 404) {
      res.status(502).json({ error: await result.text() });
      return;
    }
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
    const rec = requireSessionOwner(id, username);

    const result = await opencodeFetch(`/session/${id}/message`, {
      method: "GET",
      directory: rec.workspace,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: await result.text() });
      return;
    }
    res.json(await parseJsonBody(result));
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
    const rec = requireSessionOwner(id, username);

    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    appendAudit("message.send", username, { sessionId: id });

    const model = config.geminiApiKey
      ? {
          providerID: config.opencodeProviderId,
          modelID: config.opencodeModelId,
        }
      : undefined;

    const promptBody = {
      parts: [{ type: "text", text }],
      ...(model ? { model } : {}),
    };

    const asyncRes = await opencodeFetch(`/session/${id}/prompt_async`, {
      method: "POST",
      directory: rec.workspace,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promptBody),
    });

    if (asyncRes.status === 204 || asyncRes.ok) {
      res.status(202).json({
        ok: true,
        mode: "async",
        workspace: rec.workspace,
      });
      return;
    }

    // Fallback: sync prompt
    const syncRes = await opencodeFetch(`/session/${id}/message`, {
      method: "POST",
      directory: rec.workspace,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(promptBody),
    });

    if (!syncRes.ok) {
      const detail = await asyncRes.text().catch(() => "");
      const detail2 = await syncRes.text().catch(() => "");
      res.status(502).json({
        error: "OpenCode prompt failed",
        async: detail,
        sync: detail2,
      });
      return;
    }

    res.json(await parseJsonBody(syncRes));
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
    const rec = requireSessionOwner(id, username);

    const result = await opencodeFetch(`/session/${id}/abort`, {
      method: "POST",
      directory: rec.workspace,
    });
    res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      detail: result.ok ? undefined : await result.text(),
    });
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
      const rec = requireSessionOwner(id, username);

      const response = String(req.body?.response ?? "reject");
      const allowed = ["once", "always", "reject"];
      if (!allowed.includes(response)) {
        res.status(400).json({ error: "response must be once|always|reject" });
        return;
      }

      const r = await opencodeFetch(
        `/session/${id}/permissions/${permissionId}`,
        {
          method: "POST",
          directory: rec.workspace,
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
        res
          .status(502)
          .json({ error: "permission respond failed", detail: body });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 502).json({ error: err.message });
    }
  },
);

/** Debug helper — not used by UI */
export function sessionCreateUrl(workspace: string): string {
  return opencodeUrl("/session", workspace);
}

function pathEquals(a: string, b: string): boolean {
  const norm = (p: string) =>
    p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}
