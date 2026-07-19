import { createOpencodeClient } from "@opencode-ai/sdk";
import { config } from "../config.js";
import type { HealthStatus } from "../types.js";
import { opencodeFetch } from "./http.js";
import fs from "node:fs";
import path from "node:path";

export type OpencodeClient = ReturnType<typeof createOpencodeClient>;

let client: OpencodeClient | null = null;

export function getOpencodeClient(): OpencodeClient {
  if (!client) {
    client = createOpencodeClient({
      baseUrl: config.opencodeBaseUrl,
    });
  }
  return client;
}

export async function checkOpencodeHealth(): Promise<"up" | "down"> {
  try {
    const res = await fetch(`${config.opencodeBaseUrl}/global/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "down";
    return "up";
  } catch {
    return "down";
  }
}

export function llmStatus(): "configured" | "missing" {
  return config.geminiApiKey.trim() ? "configured" : "missing";
}

export async function getHealth(): Promise<HealthStatus> {
  const { checkRagDb } = await import("../rag/db.js");
  const { resolveGeminiKey } = await import("../credentials/vault.js");
  return {
    server: "ok",
    opencode: await checkOpencodeHealth(),
    llm: resolveGeminiKey() ? "configured" : "missing",
    rag: await checkRagDb(),
  };
}

/** Write local opencode config + inject Gemini API key */
export async function configureGeminiIfNeeded(): Promise<void> {
  if (!config.geminiApiKey.trim()) return;

  // Project-local opencode config (helps managed process pick model)
  try {
    const cfgDir = path.join(config.projectRoot, ".opencode");
    fs.mkdirSync(cfgDir, { recursive: true });
    const cfgPath = path.join(config.projectRoot, "opencode.json");
    const cfg = {
      $schema: "https://opencode.ai/config.json",
      model: `${config.opencodeProviderId}/${config.opencodeModelId}`,
      provider: {
        [config.opencodeProviderId]: {
          options: {
            apiKey: "{env:GEMINI_API_KEY}",
          },
        },
      },
    };
    // Prefer env reference in file if supported; also write auth via API
    fs.writeFileSync(
      cfgPath,
      JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          model: `${config.opencodeProviderId}/${config.opencodeModelId}`,
        },
        null,
        2,
      ),
      "utf8",
    );
    void cfg;
    void cfgDir;
  } catch (err) {
    console.warn("[opencode] config write failed:", err);
  }

  if ((await checkOpencodeHealth()) !== "up") return;

  try {
    const providerIds = [config.opencodeProviderId, "google", "gemini"];
    for (const id of [...new Set(providerIds)]) {
      try {
        const res = await fetch(`${config.opencodeBaseUrl}/auth/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "api", key: config.geminiApiKey }),
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          console.log(`[opencode] auth set for provider=${id}`);
        }
      } catch {
        // ignore per-provider failure
      }
    }
  } catch (err) {
    console.warn("[opencode] Gemini configure failed:", err);
  }
}

export async function probeDirectorySession(
  directory: string,
): Promise<boolean> {
  try {
    const res = await opencodeFetch("/session", {
      method: "GET",
      directory,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function resetOpencodeClient(): void {
  client = null;
}
