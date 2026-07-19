import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "../auth/requireAuth.js";
import { config } from "../config.js";
import { appendAudit } from "../audit.js";
import * as projects from "../projects.js";
import { bootstrapUserWorkspace } from "../workspaceBootstrap.js";

export const templatesRouter = Router();

function ensureDefaultTemplates(): void {
  fs.mkdirSync(config.templatesRoot, { recursive: true });
  const defs: Array<{ id: string; name: string; files: Record<string, string> }> =
    [
      {
        id: "node-api",
        name: "Node API starter",
        files: {
          "package.json": JSON.stringify(
            {
              name: "codeharbor-node-api",
              private: true,
              type: "module",
              scripts: { start: "node index.js" },
            },
            null,
            2,
          ),
          "index.js": `console.log("CodeHarbor Node API starter");\n`,
          "README.md": `# Node API starter\n\nScaffolded by CodeHarbor template.\n`,
          "AGENTS.md": `# Agent notes\n\nKeep changes small. Prefer tests when adding endpoints.\n`,
        },
      },
      {
        id: "python-service",
        name: "Python service starter",
        files: {
          "main.py": `def main():\n    print("CodeHarbor Python starter")\n\nif __name__ == "__main__":\n    main()\n`,
          "requirements.txt": `# add deps here\n`,
          "README.md": `# Python service starter\n\nScaffolded by CodeHarbor.\n`,
          "AGENTS.md": `# Agent notes\n\nUse type hints. Small functions.\n`,
        },
      },
    ];
  for (const t of defs) {
    const dir = path.join(config.templatesRoot, t.id);
    if (fs.existsSync(dir)) continue;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "template.json"),
      JSON.stringify({ id: t.id, name: t.name }, null, 2),
    );
    for (const [rel, body] of Object.entries(t.files)) {
      const fp = path.join(dir, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, body, "utf8");
    }
  }
}

ensureDefaultTemplates();

templatesRouter.get("/templates", requireAuth, (_req, res) => {
  ensureDefaultTemplates();
  const list = fs
    .readdirSync(config.templatesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const metaPath = path.join(config.templatesRoot, d.name, "template.json");
      let name = d.name;
      try {
        name = (JSON.parse(fs.readFileSync(metaPath, "utf8")) as { name: string })
          .name;
      } catch {
        /* */
      }
      return { id: d.name, name };
    });
  res.json({ templates: list });
});

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === "template.json") continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

templatesRouter.post("/templates/:id/apply", requireAuth, async (req, res) => {
  const username = req.session.user!.username;
  const id = String(req.params.id);
  const src = path.join(config.templatesRoot, id);
  if (!fs.existsSync(src)) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  let dest: string;
  const projectId = req.body?.projectId
    ? String(req.body.projectId)
    : undefined;
  if (projectId) {
    const p = projects.getProject(projectId);
    if (!p || !projects.canWrite(projects.memberRole(projectId, username))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    dest = p.rootPath;
  } else {
    dest = bootstrapUserWorkspace(username);
  }

  copyDir(src, dest);
  appendAudit("template.apply", username, { templateId: id, projectId, dest });
  res.json({ ok: true, workspace: dest, templateId: id });
});
