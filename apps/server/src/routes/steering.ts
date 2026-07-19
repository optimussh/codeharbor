import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAuth, requireAdmin } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { appendAudit } from "../audit.js";

export const steeringRouter = Router();

function ensure(): void {
  fs.mkdirSync(config.steeringRoot, { recursive: true });
  const org = path.join(config.steeringRoot, "org.md");
  if (!fs.existsSync(org)) {
    fs.writeFileSync(
      org,
      `# CodeHarbor Org Steering

## Security
- Never commit API keys or secrets.
- Prefer changes inside the assigned workspace/project only.

## Engineering
- Small, reviewable diffs.
- Run tests when available before marking work done.
`,
      "utf8",
    );
  }
}

steeringRouter.get("/steering", requireAuth, (_req, res) => {
  ensure();
  const files = fs
    .readdirSync(config.steeringRoot)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      id: f.replace(/\.md$/, ""),
      name: f,
      updatedAt: fs.statSync(path.join(config.steeringRoot, f)).mtime.toISOString(),
    }));
  res.json({ documents: files });
});

steeringRouter.get("/steering/:id", requireAuth, (req, res) => {
  ensure();
  const id = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const fp = path.join(config.steeringRoot, `${id}.md`);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ id, content: fs.readFileSync(fp, "utf8") });
});

steeringRouter.put("/steering/:id", requireAdmin, (req, res) => {
  ensure();
  const id = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const content = String(req.body?.content ?? "");
  const fp = path.join(config.steeringRoot, `${id}.md`);
  fs.writeFileSync(fp, content, "utf8");
  appendAudit("steering.update", req.session.user!.username, { id });
  res.json({ ok: true, id });
});
