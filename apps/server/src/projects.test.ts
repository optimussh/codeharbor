import { describe, expect, it } from "vitest";
import * as projects from "./projects.js";

describe("projects ACL", () => {
  it("creates project and enforces member roles", async () => {
    const p = await projects.createProject({
      name: "Demo Harbor",
      createdBy: "admin",
    });
    expect(p.rootPath).toContain(p.id);
    expect(projects.memberRole(p.id, "admin")).toBe("owner");
    expect(projects.canWrite(projects.memberRole(p.id, "admin"))).toBe(true);
    expect(projects.canWrite(projects.memberRole(p.id, "user1"))).toBe(false);

    projects.addMember(p.id, "user1", "developer");
    expect(projects.canWrite(projects.memberRole(p.id, "user1"))).toBe(true);
    expect(projects.assertPathAllowed("user1", p.rootPath)).toBe(true);

    projects.addMember(p.id, "user2", "viewer");
    expect(projects.canWrite(projects.memberRole(p.id, "user2"))).toBe(false);
    expect(projects.canRead(projects.memberRole(p.id, "user2"))).toBe(true);

    projects.deleteProject(p.id);
  });
});
