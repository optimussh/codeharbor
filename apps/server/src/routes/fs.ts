import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { listTree, readWorkspaceFile } from "../workspace.js";

export const fsRouter = Router();

fsRouter.get("/fs", requireAuth, (req, res) => {
  try {
    const username = req.session.user!.username;
    const tree = listTree(config.workspacesRoot, username);
    res.json({ root: username, tree });
  } catch (e) {
    const err = e as Error;
    res.status(400).json({ error: err.message });
  }
});

fsRouter.get("/fs/content", requireAuth, (req, res) => {
  try {
    const username = req.session.user!.username;
    const rel = String(req.query.path ?? "");
    if (!rel) {
      res.status(400).json({ error: "path query required" });
      return;
    }
    const content = readWorkspaceFile(config.workspacesRoot, username, rel);
    res.json({ path: rel, content });
  } catch (e) {
    const err = e as Error;
    const status = /forbidden|escape/i.test(err.message)
      ? 403
      : /not found/i.test(err.message)
        ? 404
        : 400;
    res.status(status).json({ error: err.message });
  }
});
