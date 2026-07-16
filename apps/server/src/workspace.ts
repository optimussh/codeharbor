import fs from "node:fs";
import path from "node:path";
import type { FileNode } from "./types.js";

export function ensureWorkspace(root: string, username: string): string {
  const dir = path.join(root, username);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveWorkspacePath(
  root: string,
  username: string,
  relativePath = ".",
): string {
  const base = path.resolve(path.join(root, username));
  const target = path.resolve(base, relativePath);
  const rel = path.relative(base, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Path escapes workspace (forbidden)");
  }
  return target;
}

const IGNORE = new Set(["node_modules", ".git", ".DS_Store", "Thumbs.db"]);

export function listTree(
  root: string,
  username: string,
  relativePath = ".",
  depth = 0,
  maxDepth = 5,
): FileNode[] {
  const abs = resolveWorkspacePath(root, username, relativePath);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (!stat.isDirectory()) return [];

  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;
    const childRel =
      relativePath === "."
        ? entry.name
        : path.posix.join(relativePath.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childRel,
        type: "directory",
        children:
          depth < maxDepth
            ? listTree(root, username, childRel, depth + 1, maxDepth)
            : [],
      });
    } else if (entry.isFile()) {
      nodes.push({ name: entry.name, path: childRel, type: "file" });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export function readWorkspaceFile(
  root: string,
  username: string,
  relativePath: string,
  maxBytes = 1_000_000,
): string {
  const abs = resolveWorkspacePath(root, username, relativePath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error("File not found");
  }
  const size = fs.statSync(abs).size;
  if (size > maxBytes) {
    throw new Error("File too large");
  }
  return fs.readFileSync(abs, "utf8");
}
