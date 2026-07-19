import { Router } from "express";
import { findUser, verifyPassword } from "../users.js";
import { appendAudit } from "../audit.js";
import { requireAuth } from "./requireAuth.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { config } from "../config.js";
import { oidcRouter } from "../routes/oidc.js";

export const authRouter = Router();

authRouter.post("/login", loginLimiter, (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!config.authAllowLocal && config.oidc.enabled) {
    res.status(403).json({ error: "Local login disabled — use SSO" });
    return;
  }

  const user = findUser(username);
  if (!user || !verifyPassword(user, password)) {
    appendAudit("login.failed", username || undefined);
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.disabled) {
    appendAudit("login.failed", username, { reason: "disabled" });
    res.status(403).json({ error: "User disabled" });
    return;
  }

  const workspace = bootstrapUserWorkspace(user.username);
  req.session.user = { username: user.username, role: user.role };
  appendAudit("login", user.username, { workspace, method: "local" });

  res.json({ username: user.username, role: user.role, workspace });
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
  res.json({
    ...req.session.user,
    oidcEnabled: config.oidc.enabled,
    authAllowLocal: config.authAllowLocal,
  });
});

authRouter.use(oidcRouter);
