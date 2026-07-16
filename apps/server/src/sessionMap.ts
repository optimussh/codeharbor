import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export interface SessionRecord {
  username: string;
  workspace: string;
  createdAt: string;
}

const ownership = new Map<string, SessionRecord>();
const mapFile = () =>
  path.resolve(config.projectRoot, "data/session-map.json");

function persist(): void {
  const dir = path.dirname(mapFile());
  fs.mkdirSync(dir, { recursive: true });
  const obj: Record<string, SessionRecord> = {};
  for (const [id, rec] of ownership) obj[id] = rec;
  fs.writeFileSync(mapFile(), JSON.stringify(obj, null, 2), "utf8");
}

export function loadFromDisk(): void {
  ownership.clear();
  try {
    if (!fs.existsSync(mapFile())) return;
    const raw = JSON.parse(fs.readFileSync(mapFile(), "utf8")) as Record<
      string,
      SessionRecord | string
    >;
    for (const [id, v] of Object.entries(raw)) {
      if (typeof v === "string") {
        // legacy: username only
        ownership.set(id, {
          username: v,
          workspace: path.join(config.workspacesRoot, v),
          createdAt: new Date(0).toISOString(),
        });
      } else if (v && typeof v === "object" && v.username) {
        ownership.set(id, v);
      }
    }
  } catch (err) {
    console.warn("[sessionMap] load failed:", err);
  }
}

export function claim(
  sessionId: string,
  username: string,
  workspace: string,
): void {
  ownership.set(sessionId, {
    username,
    workspace,
    createdAt: new Date().toISOString(),
  });
  persist();
}

export function release(sessionId: string): void {
  ownership.delete(sessionId);
  persist();
}

export function ownerOf(sessionId: string): string | undefined {
  return ownership.get(sessionId)?.username;
}

export function recordOf(sessionId: string): SessionRecord | undefined {
  return ownership.get(sessionId);
}

export function listByUser(username: string): string[] {
  return [...ownership.entries()]
    .filter(([, rec]) => rec.username === username)
    .map(([id]) => id);
}

export function listRecordsByUser(
  username: string,
): Array<{ id: string } & SessionRecord> {
  return [...ownership.entries()]
    .filter(([, rec]) => rec.username === username)
    .map(([id, rec]) => ({ id, ...rec }));
}

export function assertOwner(sessionId: string, username: string): boolean {
  return ownership.get(sessionId)?.username === username;
}

export function allRecords(): Array<{ id: string } & SessionRecord> {
  return [...ownership.entries()].map(([id, rec]) => ({ id, ...rec }));
}

/** Test helper */
export function clearAll(): void {
  ownership.clear();
  try {
    if (fs.existsSync(mapFile())) fs.unlinkSync(mapFile());
  } catch {
    // ignore
  }
}
