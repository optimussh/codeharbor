import { describe, it, expect, beforeEach } from "vitest";
import * as sessionMap from "./sessionMap.js";

describe("sessionMap", () => {
  beforeEach(() => {
    sessionMap.clearAll();
  });

  it("claims and asserts owner", () => {
    sessionMap.claim("s1", "user1");
    expect(sessionMap.assertOwner("s1", "user1")).toBe(true);
    expect(sessionMap.assertOwner("s1", "user2")).toBe(false);
    expect(sessionMap.listByUser("user1")).toEqual(["s1"]);
  });

  it("releases session", () => {
    sessionMap.claim("s1", "user1");
    sessionMap.release("s1");
    expect(sessionMap.ownerOf("s1")).toBeUndefined();
  });
});
