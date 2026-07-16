import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import os from "node:os";
import * as sessionMap from "./sessionMap.js";

describe("sessionMap", () => {
  beforeEach(() => {
    sessionMap.clearAll();
  });

  it("claims and asserts owner", () => {
    const ws = path.join(os.tmpdir(), "user1");
    sessionMap.claim("s1", "user1", ws);
    expect(sessionMap.assertOwner("s1", "user1")).toBe(true);
    expect(sessionMap.assertOwner("s1", "user2")).toBe(false);
    expect(sessionMap.listByUser("user1")).toEqual(["s1"]);
    expect(sessionMap.recordOf("s1")?.workspace).toBe(ws);
  });

  it("releases session", () => {
    sessionMap.claim("s1", "user1", "/tmp/u1");
    sessionMap.release("s1");
    expect(sessionMap.ownerOf("s1")).toBeUndefined();
  });

  it("persists and reloads", () => {
    const ws = path.join(os.tmpdir(), "user1-persist");
    sessionMap.claim("s-persist", "user1", ws);
    sessionMap.loadFromDisk();
    expect(sessionMap.assertOwner("s-persist", "user1")).toBe(true);
    expect(sessionMap.recordOf("s-persist")?.workspace).toBe(ws);
  });
});
