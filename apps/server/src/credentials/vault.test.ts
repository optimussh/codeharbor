import { describe, expect, it, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import {
  putCredential,
  getCredentialPlain,
  listCredentialMeta,
  deleteCredential,
} from "./vault.js";

describe("credential vault", () => {
  beforeEach(() => {
    const f = path.join(config.projectRoot, "data", "credentials.json");
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {
      /* */
    }
  });

  it("encrypts and returns plaintext from memory/file", async () => {
    const meta = await putCredential("google", "test-secret-key-9999", "admin");
    expect(meta.last4).toBe("9999");
    expect(getCredentialPlain("google")).toBe("test-secret-key-9999");
    const list = await listCredentialMeta();
    expect(list.some((c) => c.provider === "google")).toBe(true);
    expect(JSON.stringify(list)).not.toContain("test-secret-key-9999");
    await deleteCredential("google");
  });
});
