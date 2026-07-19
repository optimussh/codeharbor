import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import * as projects from "../projects.js";
import { appendAudit } from "../audit.js";
import {
  opencodeFetch,
  parseJsonBody,
  sessionIdOf,
} from "../opencode/http.js";
import { checkOpencodeHealth } from "../opencode/client.js";
import * as sessionMap from "../sessionMap.js";
import { buildChamberOpenPath, buildChamberOpenUrl } from "../chamberUrl.js";
import { findUser } from "../users.js";

export const projectsRouter = Router();

projectsRouter.get("/projects", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  res.json({ projects: projects.listProjectsForUser(username) });
});

projectsRouter.post("/projects", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const p = await projects.createProject({
    name,
    slug: req.body?.slug ? String(req.body.slug) : undefined,
    description: req.body?.description
      ? String(req.body.description)
      : undefined,
    createdBy: username,
  });
  appendAudit("project.create", username, { projectId: p.id, slug: p.slug });
  res.status(201).json(p);
});

projectsRouter.get("/projects/:id", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const id = String(req.params.id);
  const p = projects.getProject(id);
  if (!p) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const role = projects.memberRole(id, username);
  if (!projects.canRead(role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json({ ...p, myRole: role, members: projects.listMembers(id) });
});

projectsRouter.patch("/projects/:id", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const id = String(req.params.id);
  const role = projects.memberRole(id, username);
  if (!projects.canAdmin(role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const patch: Parameters<typeof projects.updateProject>[1] = {};
  if (req.body?.name) patch.name = String(req.body.name);
  if (req.body?.description !== undefined)
    patch.description = String(req.body.description);
  if (req.body?.sandboxMode === "off" || req.body?.sandboxMode === "docker")
    patch.sandboxMode = req.body.sandboxMode;
  if (
    req.body?.networkMode === "none" ||
    req.body?.networkMode === "internal" ||
    req.body?.networkMode === "full"
  )
    patch.networkMode = req.body.networkMode;
  const p = projects.updateProject(id, patch);
  appendAudit("project.update", username, { projectId: id, patch });
  res.json(p);
});

projectsRouter.delete("/projects/:id", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const id = String(req.params.id);
  if (!projects.canAdmin(projects.memberRole(id, username))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  projects.deleteProject(id);
  appendAudit("project.delete", username, { projectId: id });
  res.json({ ok: true });
});

projectsRouter.post("/projects/:id/members", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const id = String(req.params.id);
  if (!projects.canAdmin(projects.memberRole(id, username))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const member = String(req.body?.username ?? "").trim();
  const mrole = String(req.body?.role ?? "developer") as projects.ProjectRole;
  if (!member || !findUser(member)) {
    res.status(400).json({ error: "valid username required" });
    return;
  }
  if (!["owner", "developer", "viewer"].includes(mrole)) {
    res.status(400).json({ error: "invalid role" });
    return;
  }
  projects.addMember(id, member, mrole);
  appendAudit("project.member.add", username, {
    projectId: id,
    member,
    role: mrole,
  });
  res.json({ members: projects.listMembers(id) });
});

projectsRouter.delete(
  "/projects/:id/members/:member",
  requireAuth,
  (req, res) => {
    const username = req.session.user!.username;
    const id = String(req.params.id);
    const member = String(req.params.member);
    if (!projects.canAdmin(projects.memberRole(id, username))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    projects.removeMember(id, member);
    appendAudit("project.member.remove", username, { projectId: id, member });
    res.json({ members: projects.listMembers(id) });
  },
);

/** Bind OpenCode session to project workspace + chamber auto-open URL */
projectsRouter.post("/projects/:id/bind", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const id = String(req.params.id);
  const p = projects.getProject(id);
  if (!p) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const role = projects.memberRole(id, username);
  if (!projects.canWrite(role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let sessionId: string | undefined;
  const existing = sessionMap
    .listRecordsByUser(username)
    .filter((r) => r.workspace === p.rootPath)
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    )[0];
  if (existing?.id) sessionId = existing.id;

  if (!sessionId && (await checkOpencodeHealth()) === "up") {
    try {
      const created = await opencodeFetch("/session", {
        method: "POST",
        directory: p.rootPath,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${p.slug}-${username}-${Date.now()}`,
        }),
      });
      if (created.ok) {
        const body = await parseJsonBody(created);
        sessionId = sessionIdOf(body);
        if (sessionId) sessionMap.claim(sessionId, username, p.rootPath);
      }
    } catch {
      /* optional */
    }
  }

  appendAudit("workspace.bind", username, {
    workspace: p.rootPath,
    sessionId,
    projectId: id,
  });

  res.json({
    projectId: id,
    workspace: p.rootPath,
    sessionId: sessionId ?? null,
    chamberPath: buildChamberOpenPath({
      workspace: p.rootPath,
      sessionId,
    }),
    chamberUrl: buildChamberOpenUrl({
      workspace: p.rootPath,
      sessionId,
      viaGateway: true,
    }),
    sandboxMode: p.sandboxMode,
  });
});
