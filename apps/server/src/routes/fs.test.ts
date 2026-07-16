import { describe, it, expect } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../app.js";
import { config } from "../config.js";

describe("fs routes", () => {
  const app = createApp();

  it("lists workspace files and blocks traversal", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "user1", password: "user1" });

    const ws = path.join(config.workspacesRoot, "user1");
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(path.join(ws, "hello.txt"), "hi", "utf8");

    const tree = await agent.get("/api/fs");
    expect(tree.status).toBe(200);
    expect(JSON.stringify(tree.body.tree)).toContain("hello.txt");

    const content = await agent.get("/api/fs/content").query({ path: "hello.txt" });
    expect(content.status).toBe(200);
    expect(content.body.content).toBe("hi");

    const bad = await agent
      .get("/api/fs/content")
      .query({ path: "../user2/secret.txt" });
    expect(bad.status).toBe(403);
  });
});
