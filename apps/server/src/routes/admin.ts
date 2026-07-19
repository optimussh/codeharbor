import { Router } from "express";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../auth/requireAuth.js";
import {
  publicUserList,
  findUser,
  getUsers,
  setUserDisabled,
  setUserQuota,
  setUserRole,
  createLocalUser,
} from "../users.js";
import {
  readAuditTailAsync,
  appendAudit,
  queryAudit,
  auditToCsv,
} from "../audit.js";
import { getHealth } from "../opencode/client.js";
import {
  listCredentialMeta,
  putCredential,
  deleteCredential,
} from "../credentials/vault.js";
import { aggregateUsage } from "../usage.js";
import { config } from "../config.js";
import type { Role } from "../types.js";

export const adminRouter = Router();

adminRouter.get("/admin/users", requireAdmin, (_req, res) => {
  res.json({
    users: getUsers().map((u) => ({
      username: u.username,
      role: u.role,
      disabled: u.disabled ?? false,
      dailyQuota: u.dailyQuota ?? null,
    })),
  });
});

adminRouter.post("/admin/users", requireAdmin, (req, res) => {
  const username = String(req.body?.username ?? "").trim();
  const password = String(req.body?.password ?? "");
  const role = (req.body?.role === "admin" ? "admin" : "user") as Role;
  if (!username || password.length < 3) {
    res.status(400).json({ error: "username and password (min 3) required" });
    return;
  }
  if (findUser(username)) {
    res.status(409).json({ error: "user exists" });
    return;
  }
  createLocalUser(username, password, role);
  appendAudit("admin.user.create", req.session.user!.username, {
    username,
    role,
  });
  res.status(201).json({ username, role });
});

adminRouter.patch("/admin/users/:username", requireAdmin, (req, res) => {
  const username = String(req.params.username);
  const u = findUser(username);
  if (!u) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (req.body?.role === "admin" || req.body?.role === "user") {
    setUserRole(username, req.body.role);
  }
  if (typeof req.body?.disabled === "boolean") {
    setUserDisabled(username, req.body.disabled);
  }
  if (req.body?.dailyQuota !== undefined) {
    const q =
      req.body.dailyQuota === null || req.body.dailyQuota === ""
        ? null
        : Number(req.body.dailyQuota);
    setUserQuota(username, q);
  }
  appendAudit("admin.user.patch", req.session.user!.username, {
    targetUser: username,
    body: req.body,
  });
  const next = findUser(username)!;
  res.json({
    username: next.username,
    role: next.role,
    disabled: next.disabled ?? false,
    dailyQuota: next.dailyQuota ?? null,
  });
});

adminRouter.get("/admin/audit", requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 2000);
  const events = await queryAudit({
    limit,
    username: req.query.user ? String(req.query.user) : undefined,
    action: req.query.action ? String(req.query.action) : undefined,
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
  });
  appendAudit("admin.audit.read", req.session.user!.username, { limit });
  res.json({ events });
});

adminRouter.get("/admin/audit/export", requireAdmin, async (req, res) => {
  const format = String(req.query.format ?? "csv");
  const events = await queryAudit({
    limit: 5000,
    username: req.query.user ? String(req.query.user) : undefined,
    action: req.query.action ? String(req.query.action) : undefined,
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
  });
  appendAudit("admin.audit.export", req.session.user!.username, {
    format,
    count: events.length,
  });
  if (format === "json") {
    res.json({ events });
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="codeharbor-audit.csv"`,
  );
  res.send(auditToCsv(events));
});

adminRouter.get("/admin/usage", requireAdmin, async (req, res) => {
  const agg = await aggregateUsage({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    username: req.query.user ? String(req.query.user) : undefined,
  });
  res.json(agg);
});

adminRouter.get("/admin/usage/export", requireAdmin, async (req, res) => {
  const agg = await aggregateUsage({
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
  });
  const header = "username,messages,input_tokens,output_tokens,est_cost_usd";
  const lines = agg.rows.map(
    (r) =>
      `${r.username},${r.messages},${r.inputTokens},${r.outputTokens},${r.estCostUsd.toFixed(6)}`,
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="codeharbor-usage.csv"`,
  );
  res.send([header, ...lines].join("\n"));
});

adminRouter.get("/admin/credentials", requireAdmin, async (_req, res) => {
  res.json({ credentials: await listCredentialMeta() });
});

adminRouter.put("/admin/credentials/:provider", requireAdmin, async (req, res) => {
  const provider = String(req.params.provider).trim();
  const apiKey = String(req.body?.apiKey ?? "");
  if (!provider || !apiKey) {
    res.status(400).json({ error: "provider and apiKey required" });
    return;
  }
  try {
    const meta = await putCredential(
      provider,
      apiKey,
      req.session.user!.username,
    );
    appendAudit("admin.credential.put", req.session.user!.username, {
      provider,
      last4: meta.last4,
    });
    res.json(meta);
  } catch (e) {
    res.status(400).json({
      error: e instanceof Error ? e.message : "failed",
    });
  }
});

adminRouter.delete(
  "/admin/credentials/:provider",
  requireAdmin,
  async (req, res) => {
    const provider = String(req.params.provider);
    await deleteCredential(provider);
    appendAudit("admin.credential.delete", req.session.user!.username, {
      provider,
    });
    res.json({ ok: true });
  },
);

adminRouter.get("/admin/settings", requireAdmin, (_req, res) => {
  res.json({
    oidcEnabled: config.oidc.enabled,
    oidcConfigured: Boolean(config.oidc.issuer && config.oidc.clientId),
    authAllowLocal: config.authAllowLocal,
    sandboxEnabled: config.sandboxEnabled,
    dailyMessageQuotaDefault: config.dailyMessageQuota,
    product: "CodeHarbor",
  });
});

adminRouter.get("/admin/health", requireAdmin, async (_req, res) => {
  res.json(await getHealth());
});

// keep publicUserList import used for type side effects
void publicUserList;
void bcrypt;
void readAuditTailAsync;
