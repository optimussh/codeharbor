import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { checkRagDb, withClient } from "../rag/db.js";

export type CredentialMeta = {
  provider: string;
  last4: string;
  updatedBy?: string;
  updatedAt: string;
};

type StoredCred = {
  ciphertext: string;
  iv: string;
  tag: string;
  last4: string;
  updatedBy?: string;
  updatedAt: string;
};

const memory = new Map<string, string>(); // provider -> plaintext
const fileStore = () =>
  path.join(config.projectRoot, "data", "credentials.json");

function masterKey(): Buffer {
  const raw = config.credentialsMasterKey;
  const buf = Buffer.from(raw, raw.length === 44 || raw.endsWith("=") ? "base64" : "utf8");
  // aes-256 needs 32 bytes
  return crypto.createHash("sha256").update(buf).digest();
}

function encrypt(plain: string): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt(parts: { ciphertext: string; iv: string; tag: string }): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(parts.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parts.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function loadFile(): Record<string, StoredCred> {
  try {
    if (!fs.existsSync(fileStore())) return {};
    return JSON.parse(fs.readFileSync(fileStore(), "utf8")) as Record<
      string,
      StoredCred
    >;
  } catch {
    return {};
  }
}

function saveFile(all: Record<string, StoredCred>): void {
  fs.mkdirSync(path.dirname(fileStore()), { recursive: true });
  fs.writeFileSync(fileStore(), JSON.stringify(all, null, 2), "utf8");
}

/** Bootstrap env GEMINI into vault memory (never write env secrets to logs). */
export function bootstrapCredentialsFromEnv(): void {
  const g = config.geminiApiKey.trim();
  if (g) memory.set("google", g);
}

export async function putCredential(
  provider: string,
  apiKey: string,
  updatedBy?: string,
): Promise<CredentialMeta> {
  const plain = apiKey.trim();
  if (!plain) throw new Error("apiKey required");
  const enc = encrypt(plain);
  const meta: CredentialMeta = {
    provider,
    last4: plain.slice(-4),
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
  memory.set(provider, plain);

  const stored: StoredCred = {
    ...enc,
    last4: meta.last4,
    updatedBy,
    updatedAt: meta.updatedAt,
  };

  const all = loadFile();
  all[provider] = stored;
  saveFile(all);

  try {
    if ((await checkRagDb()) === "up") {
      await withClient(async (client) => {
        await client.query(
          `INSERT INTO api_credentials (provider, ciphertext, iv, tag, last4, updated_by, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz)
           ON CONFLICT (provider) DO UPDATE SET
             ciphertext = EXCLUDED.ciphertext,
             iv = EXCLUDED.iv,
             tag = EXCLUDED.tag,
             last4 = EXCLUDED.last4,
             updated_by = EXCLUDED.updated_by,
             updated_at = EXCLUDED.updated_at`,
          [
            provider,
            stored.ciphertext,
            stored.iv,
            stored.tag,
            stored.last4,
            updatedBy ?? null,
            stored.updatedAt,
          ],
        );
      });
    }
  } catch {
    // file fallback ok
  }

  if (provider === "google") {
    process.env.GEMINI_API_KEY = plain;
    (config as { geminiApiKey: string }).geminiApiKey = plain;
  }
  return meta;
}

export async function deleteCredential(provider: string): Promise<boolean> {
  memory.delete(provider);
  const all = loadFile();
  const had = Boolean(all[provider]);
  delete all[provider];
  saveFile(all);
  try {
    if ((await checkRagDb()) === "up") {
      await withClient(async (c) => {
        await c.query(`DELETE FROM api_credentials WHERE provider = $1`, [
          provider,
        ]);
      });
    }
  } catch {
    /* ignore */
  }
  if (provider === "google") {
    process.env.GEMINI_API_KEY = "";
    (config as { geminiApiKey: string }).geminiApiKey = "";
  }
  return had;
}

export function getCredentialPlain(provider: string): string | undefined {
  if (memory.has(provider)) return memory.get(provider);
  const all = loadFile();
  const s = all[provider];
  if (!s) {
    if (provider === "google" && config.geminiApiKey) return config.geminiApiKey;
    return undefined;
  }
  try {
    const plain = decrypt(s);
    memory.set(provider, plain);
    return plain;
  } catch {
    return undefined;
  }
}

export async function listCredentialMeta(): Promise<CredentialMeta[]> {
  const out = new Map<string, CredentialMeta>();
  const all = loadFile();
  for (const [provider, s] of Object.entries(all)) {
    out.set(provider, {
      provider,
      last4: s.last4,
      updatedBy: s.updatedBy,
      updatedAt: s.updatedAt,
    });
  }
  try {
    if ((await checkRagDb()) === "up") {
      await withClient(async (client) => {
        const res = await client.query<{
          provider: string;
          last4: string;
          updated_by: string | null;
          updated_at: Date;
        }>(`SELECT provider, last4, updated_by, updated_at FROM api_credentials`);
        for (const r of res.rows) {
          out.set(r.provider, {
            provider: r.provider,
            last4: r.last4,
            updatedBy: r.updated_by ?? undefined,
            updatedAt: new Date(r.updated_at).toISOString(),
          });
        }
      });
    }
  } catch {
    /* ignore */
  }
  if (config.geminiApiKey && !out.has("google")) {
    out.set("google", {
      provider: "google",
      last4: config.geminiApiKey.slice(-4),
      updatedAt: new Date(0).toISOString(),
    });
  }
  return [...out.values()].sort((a, b) => a.provider.localeCompare(b.provider));
}

export function resolveGeminiKey(): string {
  return (
    getCredentialPlain("google")?.trim() ||
    config.geminiApiKey.trim() ||
    ""
  );
}
