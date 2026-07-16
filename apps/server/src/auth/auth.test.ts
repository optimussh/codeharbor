import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

describe("auth", () => {
  const app = createApp({ managedOpencode: false });

  it("rejects bad password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "user1", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("logs in and returns me", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/auth/login")
      .send({ username: "user1", password: "user1" });
    expect(login.status).toBe(200);
    expect(login.body.username).toBe("user1");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ username: "user1", role: "user" });
  });

  it("blocks me when logged out", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("admin can list users", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "admin", password: "admin123" });
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ username: "admin", role: "admin" }),
        expect.objectContaining({ username: "user1", role: "user" }),
      ]),
    );
  });

  it("user cannot list admin users", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ username: "user1", password: "user1" });
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(403);
  });
});
