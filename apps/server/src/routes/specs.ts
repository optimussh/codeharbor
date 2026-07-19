import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { appendAudit } from "../audit.js";
import * as projects from "../projects.js";

export const specsRouter = Router();

export type SpecTask = {
  id: string;
  title: string;
  done: boolean;
};

export type SpecDoc = {
  id: string;
  projectId?: string;
  username: string;
  title: string;
  requirements: string;
  design: string;
  tasks: SpecTask[];
  createdAt: string;
  updatedAt: string;
};

const mem = new Map<string, SpecDoc>();

function filePath(): string {
  return path.join(config.specsRoot, "specs.json");
}

function load(): void {
  try {
    fs.mkdirSync(config.specsRoot, { recursive: true });
    if (!fs.existsSync(filePath())) return;
    const arr = JSON.parse(fs.readFileSync(filePath(), "utf8")) as SpecDoc[];
    for (const s of arr) mem.set(s.id, s);
  } catch {
    /* */
  }
}

function save(): void {
  fs.mkdirSync(config.specsRoot, { recursive: true });
  fs.writeFileSync(
    filePath(),
    JSON.stringify([...mem.values()], null, 2),
    "utf8",
  );
}

load();

function canAccess(spec: SpecDoc, username: string): boolean {
  if (spec.username === username) return true;
  if (spec.projectId) {
    return projects.canRead(projects.memberRole(spec.projectId, username));
  }
  return false;
}

function canEdit(spec: SpecDoc, username: string): boolean {
  if (spec.username === username) return true;
  if (spec.projectId) {
    return projects.canWrite(projects.memberRole(spec.projectId, username));
  }
  return false;
}

specsRouter.get("/specs", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const list = [...mem.values()].filter((s) => canAccess(s, username));
  res.json({ specs: list });
});

specsRouter.post("/specs", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const title = String(req.body?.title ?? "Untitled spec").trim();
  const projectId = req.body?.projectId
    ? String(req.body.projectId)
    : undefined;
  if (projectId && !projects.canWrite(projects.memberRole(projectId, username))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const now = new Date().toISOString();
  const doc: SpecDoc = {
    id: crypto.randomUUID(),
    projectId,
    username,
    title,
    requirements: String(req.body?.requirements ?? ""),
    design: String(req.body?.design ?? ""),
    tasks: Array.isArray(req.body?.tasks) ? req.body.tasks : [],
    createdAt: now,
    updatedAt: now,
  };
  mem.set(doc.id, doc);
  save();
  appendAudit("spec.create", username, { specId: doc.id, projectId });
  res.status(201).json(doc);
});

specsRouter.get("/specs/:id", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const doc = mem.get(String(req.params.id));
  if (!doc || !canAccess(doc, username)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(doc);
});

specsRouter.patch("/specs/:id", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const doc = mem.get(String(req.params.id));
  if (!doc || !canEdit(doc, username)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (req.body?.title !== undefined) doc.title = String(req.body.title);
  if (req.body?.requirements !== undefined)
    doc.requirements = String(req.body.requirements);
  if (req.body?.design !== undefined) doc.design = String(req.body.design);
  if (Array.isArray(req.body?.tasks)) doc.tasks = req.body.tasks;
  doc.updatedAt = new Date().toISOString();
  mem.set(doc.id, doc);
  save();
  appendAudit("spec.update", username, { specId: doc.id });
  res.json(doc);
});

specsRouter.post("/specs/:id/tasks/:taskId/toggle", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const doc = mem.get(String(req.params.id));
  if (!doc || !canEdit(doc, username)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const taskId = String(req.params.taskId);
  const t = doc.tasks.find((x) => x.id === taskId);
  if (!t) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  t.done = !t.done;
  doc.updatedAt = new Date().toISOString();
  save();
  res.json(doc);
});
