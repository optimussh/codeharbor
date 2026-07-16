import { createOpencodeClient } from "@opencode-ai/sdk";
import { config } from "../config.js";
import type { HealthStatus } from "../types.js";

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
  return {
    server: "ok",
    opencode: await checkOpencodeHealth(),
    llm: llmStatus(),
  };
}

/** Best-effort Gemini provider key injection for OpenCode */
export async function configureGeminiIfNeeded(): Promise<void> {
  if (!config.geminiApiKey.trim()) return;
  if ((await checkOpencodeHealth()) !== "up") return;

  try {
    const oc = getOpencodeClient();
    // Try common provider IDs used by OpenCode / models.dev
    const providerIds = ["google", "gemini"];
    for (const id of providerIds) {
      try {
        // SDK auth.set shape may vary by version — fall back to raw HTTP
        await fetch(`${config.opencodeBaseUrl}/auth/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "api", key: config.geminiApiKey }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // ignore per-provider failure
      }
      void oc;
    }
    console.log("[opencode] Gemini key injection attempted");
  } catch (err) {
    console.warn("[opencode] Gemini configure failed:", err);
  }
}

export function resetOpencodeClient(): void {
  client = null;
}
