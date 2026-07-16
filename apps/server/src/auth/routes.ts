import { Router } from "express";
import { findUser, verifyPassword } from "../users.js";
import { ensureWorkspace } from "../workspace.js";
import { config } from "../config.js";
import { appendAudit } from "../audit.js";
import { requireAuth } from "./requireAuth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  const user = findUser(username);
  if (!user || !verifyPassword(user, password)) {
    appendAudit("login.failed", username || undefined);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  ensureWorkspace(config.workspacesRoot, user.username);
  req.session.user = { username: user.username, role: user.role };
  appendAudit("login", user.username);

  res.json({ username: user.username, role: user.role });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const username = req.session.user?.username;
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("vibe.sid");
    appendAudit("logout", username);
    res.json({ ok: true });
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(req.session.user);
});
