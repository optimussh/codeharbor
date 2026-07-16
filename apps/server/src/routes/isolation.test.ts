import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../app.js";
import { config } from "../config.js";
import * as sessionMap from "../sessionMap.js";

describe("multi-user isolation (Phase 1)", () => {
  const app = createApp();

  beforeAll(() => {
    sessionMap.clearAll();
    for (const u of ["user1", "user2"]) {
      const dir = path.join(config.workspacesRoot, u);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${u}-only.txt`), u, "utf8");
    }
  });

  it("user2 cannot read user1 files via path traversal", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "user2", password: "user2" });

    const bad = await agent
      .get("/api/fs/content")
      .query({ path: "../user1/user1-only.txt" });
    expect(bad.status).toBe(403);
  });

  it("user1 sees only own workspace tree", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "user1", password: "user1" });

    const tree = await agent.get("/api/fs");
    expect(tree.status).toBe(200);
    expect(tree.body.root).toBe("user1");
    const json = JSON.stringify(tree.body.tree);
    expect(json).toContain("user1-only.txt");
    expect(json).not.toContain("user2-only.txt");
  });

  it("user2 cannot access user1 session by id", async () => {
    const ws = path.join(config.workspacesRoot, "user1");
    sessionMap.claim("ses_fake_user1", "user1", ws);

    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "user2", password: "user2" });

    const res = await agent.get("/api/sessions/ses_fake_user1");
    expect(res.status).toBe(403);
  });

  it("workspace endpoint returns own path", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "user1", password: "user1" });
    const res = await agent.get("/api/workspace");
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("user1");
    expect(String(res.body.path)).toContain("user1");
  });

  it("admin can list workspace summaries", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    const res = await agent.get("/api/admin/workspaces");
    expect(res.status).toBe(200);
    expect(res.body.workspaces.length).toBeGreaterThanOrEqual(3);
  });
});
