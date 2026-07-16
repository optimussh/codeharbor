import { Router } from "express";
import { requireAdmin } from "../auth/requireAuth.js";
import { publicUserList } from "../users.js";
import { readAuditTail, appendAudit } from "../audit.js";
import { getHealth } from "../opencode/client.js";

export const adminRouter = Router();

adminRouter.get("/admin/users", requireAdmin, (_req, res) => {
  res.json({ users: publicUserList() });
});

adminRouter.get("/admin/audit", requireAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  appendAudit("admin.audit.read", req.session.user!.username, { limit });
  res.json({ events: readAuditTail(limit) });
});

adminRouter.get("/admin/health", requireAdmin, async (_req, res) => {
  res.json(await getHealth());
});
