import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveWorkspacePath, ensureWorkspace } from "./workspace.js";

describe("workspace path isolation", () => {
  const root = path.join(os.tmpdir(), `vibe-ws-${Date.now()}`);

  beforeAll(() => {
    fs.mkdirSync(root, { recursive: true });
  });

  it("resolves paths inside workspace", () => {
    ensureWorkspace(root, "user1");
    const p = resolveWorkspacePath(root, "user1", "src/app.ts");
    expect(p.startsWith(path.join(root, "user1"))).toBe(true);
  });

  it("rejects path traversal", () => {
    ensureWorkspace(root, "user1");
    expect(() =>
      resolveWorkspacePath(root, "user1", "../user2/secret.txt"),
    ).toThrow(/escape|forbidden|outside/i);
  });
});
