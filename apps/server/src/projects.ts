import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";
import { checkRagDb, withClient } from "./rag/db.js";

export type ProjectRole = "owner" | "developer" | "viewer";

export type Project = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  rootPath: string;
  createdBy: string;
  sandboxMode: "off" | "docker";
  networkMode: "none" | "internal" | "full";
  createdAt: string;
};

export type ProjectMember = {
  projectId: string;
  username: string;
  role: ProjectRole;
};

const memProjects = new Map<string, Project>();
const memMembers = new Map<string, ProjectMember[]>(); // projectId -> members

function storeFile(): string {
  return path.join(config.projectRoot, "data", "projects-index.json");
}

function loadDisk(): void {
  try {
    if (!fs.existsSync(storeFile())) return;
    const raw = JSON.parse(fs.readFileSync(storeFile(), "utf8")) as {
      projects: Project[];
      members: ProjectMember[];
    };
    for (const p of raw.projects ?? []) memProjects.set(p.id, p);
    const by: Record<string, ProjectMember[]> = {};
    for (const m of raw.members ?? []) {
      (by[m.projectId] ??= []).push(m);
    }
    for (const [k, v] of Object.entries(by)) memMembers.set(k, v);
  } catch {
    /* ignore */
  }
}

function saveDisk(): void {
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  const projects = [...memProjects.values()];
  const members = [...memMembers.values()].flat();
  fs.writeFileSync(
    storeFile(),
    JSON.stringify({ projects, members }, null, 2),
    "utf8",
  );
}

loadDisk();

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `p-${Date.now().toString(36)}`
  );
}

export function bootstrapProjectDir(rootPath: string, meta: Project): void {
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(
    path.join(rootPath, ".codeharbor.json"),
    JSON.stringify(
      { id: meta.id, slug: meta.slug, name: meta.name, platform: "codeharbor" },
      null,
      2,
    ),
    "utf8",
  );
  const agents = path.join(rootPath, "AGENTS.md");
  if (!fs.existsSync(agents)) {
    fs.writeFileSync(
      agents,
      `# Project: ${meta.name}\n\nCodeHarbor shared project workspace.\n- Prefer changes inside this folder.\n- Follow team steering rules.\n`,
      "utf8",
    );
  }
  const readme = path.join(rootPath, "README.md");
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, `# ${meta.name}\n\nShared CodeHarbor project.\n`, "utf8");
  }
}

export async function createProject(input: {
  name: string;
  slug?: string;
  description?: string;
  createdBy: string;
}): Promise<Project> {
  const id = crypto.randomUUID();
  let slug = input.slug?.trim() || slugify(input.name);
  // unique
  if ([...memProjects.values()].some((p) => p.slug === slug)) {
    slug = `${slug}-${id.slice(0, 6)}`;
  }
  const rootPath = path.join(config.projectsRoot, id);
  const project: Project = {
    id,
    slug,
    name: input.name.trim(),
    description: input.description,
    rootPath,
    createdBy: input.createdBy,
    sandboxMode: "off",
    networkMode: "none",
    createdAt: new Date().toISOString(),
  };
  bootstrapProjectDir(rootPath, project);
  memProjects.set(id, project);
  memMembers.set(id, [
    { projectId: id, username: input.createdBy, role: "owner" },
  ]);
  saveDisk();
  void persistProjectPg(project);
  void persistMemberPg(id, input.createdBy, "owner");
  return project;
}

async function persistProjectPg(p: Project): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (c) => {
      await c.query(
        `INSERT INTO projects (id, slug, name, description, root_path, created_by, sandbox_mode, network_mode, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz)
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
           sandbox_mode=EXCLUDED.sandbox_mode, network_mode=EXCLUDED.network_mode`,
        [
          p.id,
          p.slug,
          p.name,
          p.description ?? null,
          p.rootPath,
          p.createdBy,
          p.sandboxMode,
          p.networkMode,
          p.createdAt,
        ],
      );
    });
  } catch {
    /* ignore */
  }
}

async function persistMemberPg(
  projectId: string,
  username: string,
  role: ProjectRole,
): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (c) => {
      await c.query(
        `INSERT INTO project_members (project_id, username, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (project_id, username) DO UPDATE SET role = EXCLUDED.role`,
        [projectId, username, role],
      );
    });
  } catch {
    /* ignore */
  }
}

export function getProject(id: string): Project | undefined {
  return memProjects.get(id);
}

export function listProjectsForUser(username: string): Array<
  Project & { myRole: ProjectRole }
> {
  const out: Array<Project & { myRole: ProjectRole }> = [];
  for (const p of memProjects.values()) {
    const m = (memMembers.get(p.id) ?? []).find((x) => x.username === username);
    if (m) out.push({ ...p, myRole: m.role });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function memberRole(
  projectId: string,
  username: string,
): ProjectRole | undefined {
  return (memMembers.get(projectId) ?? []).find((m) => m.username === username)
    ?.role;
}

export function canRead(role?: ProjectRole): boolean {
  return role === "owner" || role === "developer" || role === "viewer";
}

export function canWrite(role?: ProjectRole): boolean {
  return role === "owner" || role === "developer";
}

export function canAdmin(role?: ProjectRole): boolean {
  return role === "owner";
}

export function listMembers(projectId: string): ProjectMember[] {
  return [...(memMembers.get(projectId) ?? [])];
}

export function addMember(
  projectId: string,
  username: string,
  role: ProjectRole,
): void {
  const list = memMembers.get(projectId) ?? [];
  const i = list.findIndex((m) => m.username === username);
  if (i >= 0) list[i] = { projectId, username, role };
  else list.push({ projectId, username, role });
  memMembers.set(projectId, list);
  saveDisk();
  void persistMemberPg(projectId, username, role);
}

export function removeMember(projectId: string, username: string): boolean {
  const list = memMembers.get(projectId) ?? [];
  const next = list.filter((m) => m.username !== username);
  if (next.length === list.length) return false;
  memMembers.set(projectId, next);
  saveDisk();
  void (async () => {
    try {
      if ((await checkRagDb()) !== "up") return;
      await withClient(async (c) => {
        await c.query(
          `DELETE FROM project_members WHERE project_id=$1 AND username=$2`,
          [projectId, username],
        );
      });
    } catch {
      /* ignore */
    }
  })();
  return true;
}

export function updateProject(
  id: string,
  patch: Partial<
    Pick<Project, "name" | "description" | "sandboxMode" | "networkMode">
  >,
): Project | undefined {
  const p = memProjects.get(id);
  if (!p) return undefined;
  const next = { ...p, ...patch };
  memProjects.set(id, next);
  saveDisk();
  void persistProjectPg(next);
  return next;
}

export function deleteProject(id: string): boolean {
  if (!memProjects.has(id)) return false;
  memProjects.delete(id);
  memMembers.delete(id);
  saveDisk();
  void (async () => {
    try {
      if ((await checkRagDb()) !== "up") return;
      await withClient(async (c) => {
        await c.query(`DELETE FROM project_members WHERE project_id=$1`, [id]);
        await c.query(`DELETE FROM projects WHERE id=$1`, [id]);
      });
    } catch {
      /* ignore */
    }
  })();
  return true;
}

/** Absolute paths the user may use as OpenCode directory */
export function allowedRoots(username: string): string[] {
  const roots = [path.resolve(config.workspacesRoot, username)];
  for (const p of listProjectsForUser(username)) {
    roots.push(path.resolve(p.rootPath));
  }
  return roots;
}

export function assertPathAllowed(username: string, absPath: string): boolean {
  const resolved = path.resolve(absPath);
  const norm = (p: string) =>
    p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const target = norm(resolved);
  return allowedRoots(username).some((root) => {
    const r = norm(root);
    return target === r || target.startsWith(r + "/");
  });
}
