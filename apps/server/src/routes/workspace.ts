import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAuth, requireAdmin } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { ensureWorkspace, listTree } from "../workspace.js";
import { publicUserList } from "../users.js";
import * as sessionMap from "../sessionMap.js";

export const workspaceRouter = Router();

workspaceRouter.get("/workspace", requireAuth, (req, res) => {
  const username = req.session.user!.username;
  const root = ensureWorkspace(config.workspacesRoot, username);
  const tree = listTree(config.workspacesRoot, username);
  res.json({
    username,
    path: root,
    sessionCount: sessionMap.listByUser(username).length,
    tree,
  });
});

/** Admin: per-user workspace summary (paths + sizes, no cross-session hijack) */
workspaceRouter.get("/admin/workspaces", requireAdmin, (_req, res) => {
  const users = publicUserList();
  const rows = users.map((u) => {
    const root = ensureWorkspace(config.workspacesRoot, u.username);
    let fileCount = 0;
    let bytes = 0;
    try {
      const walk = (dir: string) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          if (ent.name === "node_modules" || ent.name === ".git") continue;
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(p);
          else if (ent.isFile()) {
            fileCount += 1;
            bytes += fs.statSync(p).size;
          }
        }
      };
      walk(root);
    } catch {
      // empty
    }
    return {
      username: u.username,
      role: u.role,
      path: root,
      fileCount,
      bytes,
      sessions: sessionMap.listByUser(u.username).length,
    };
  });
  res.json({ workspaces: rows });
});
