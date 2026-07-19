import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import * as projects from "../projects.js";
import * as sandbox from "../sandbox/manager.js";
import { appendAudit } from "../audit.js";
import { config } from "../config.js";

export const sandboxRouter = Router();

function resolveWorkspace(
  username: string,
  projectId?: string,
): { key: string; workspace: string; network: string } | { error: string; status: number } {
  if (projectId) {
    const p = projects.getProject(projectId);
    if (!p) return { error: "Project not found", status: 404 };
    const role = projects.memberRole(projectId, username);
    if (!projects.canWrite(role)) return { error: "Forbidden", status: 403 };
    return {
      key: `p-${projectId}`,
      workspace: p.rootPath,
      network: p.networkMode,
    };
  }
  return {
    key: `u-${username}`,
    workspace: bootstrapUserWorkspace(username),
    network: config.sandboxDefaultNetwork,
  };
}

sandboxRouter.get("/sandbox/status", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const projectId = req.query.projectId
    ? String(req.query.projectId)
    : undefined;
  const resolved = resolveWorkspace(username, projectId);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const st = sandbox.getStatus(resolved.key);
  res.json({
    ...st,
    dockerAvailable: await sandbox.dockerAvailable(),
    sandboxEnabled: config.sandboxEnabled,
  });
});

sandboxRouter.post("/sandbox/start", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const projectId = req.body?.projectId
    ? String(req.body.projectId)
    : undefined;
  const resolved = resolveWorkspace(username, projectId);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const st = await sandbox.startSandbox({
    key: resolved.key,
    workspace: resolved.workspace,
    network: resolved.network,
  });
  appendAudit("sandbox.start", username, {
    projectId,
    running: st.running,
    error: st.error,
  });
  res.status(st.running ? 200 : 503).json(st);
});

sandboxRouter.post("/sandbox/stop", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const projectId = req.body?.projectId
    ? String(req.body.projectId)
    : undefined;
  const resolved = resolveWorkspace(username, projectId);
  if ("error" in resolved) {
    res.status(resolved.status).json({ error: resolved.error });
    return;
  }
  const st = await sandbox.stopSandbox(resolved.key);
  appendAudit("sandbox.stop", username, { projectId });
  res.json(st);
});
