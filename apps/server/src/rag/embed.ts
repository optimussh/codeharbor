import { config } from "../config.js";
import { resolveGeminiKey } from "../credentials/vault.js";

/** Deterministic local embedding (no API) — cosine-usable for demo/tests */
export function localEmbed(text: string, dims = config.embeddingDims): number[] {
  const v = new Array<number>(dims).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const t of tokens) {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dims;
    v[idx] += 1 + (t.length % 3) * 0.1;
    v[(idx + 7) % dims] += 0.3;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embedText(text: string): Promise<{
  vector: number[];
  provider: "gemini" | "local";
}> {
  const key = resolveGeminiKey();
  if (!key) {
    return { vector: localEmbed(text), provider: "local" };
  }

  try {
    const model = config.embeddingModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.warn("[embed] gemini failed, fallback local:", detail.slice(0, 200));
      return { vector: localEmbed(text), provider: "local" };
    }
    const data = (await res.json()) as {
      embedding?: { values?: number[] };
    };
    const values = data.embedding?.values;
    if (!values?.length) {
      return { vector: localEmbed(text), provider: "local" };
    }
    // pad/truncate to embeddingDims
    const dims = config.embeddingDims;
    const out = new Array<number>(dims).fill(0);
    for (let i = 0; i < Math.min(dims, values.length); i++) out[i] = values[i]!;
    const norm = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
    return { vector: out.map((x) => x / norm), provider: "gemini" };
  } catch (err) {
    console.warn("[embed] error, fallback local:", err);
    return { vector: localEmbed(text), provider: "local" };
  }
}

export function vectorToSql(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
