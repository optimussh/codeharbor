import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { checkRagDb, withClient } from "./rag/db.js";

export type UsageKind = "message" | "embed" | "completion";

export type UsageInput = {
  username: string;
  projectId?: string;
  sessionId?: string;
  kind: UsageKind;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  meta?: Record<string, unknown>;
};

export type UsageRow = UsageInput & {
  ts: string;
  estCostUsd: number;
};

function estimateCost(
  kind: UsageKind,
  inputTokens = 0,
  outputTokens = 0,
): number {
  if (kind === "embed") {
    return (inputTokens / 1e6) * config.costEmbedPer1M;
  }
  return (
    (inputTokens / 1e6) * config.costInputPer1M +
    (outputTokens / 1e6) * config.costOutputPer1M
  );
}

/** Rough char→token estimate when provider doesn't return counts */
export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

const filePath = () =>
  path.join(config.projectRoot, "data", "usage", "usage.jsonl");

export function recordUsage(input: UsageInput): UsageRow {
  const row: UsageRow = {
    ...input,
    ts: new Date().toISOString(),
    estCostUsd: estimateCost(
      input.kind,
      input.inputTokens ?? 0,
      input.outputTokens ?? 0,
    ),
  };
  try {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    fs.appendFileSync(filePath(), `${JSON.stringify(row)}\n`, "utf8");
  } catch {
    /* ignore */
  }
  void persistPg(row);
  return row;
}

async function persistPg(row: UsageRow): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") return;
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO usage_records
         (ts, username, project_id, session_id, kind, model, input_tokens, output_tokens, est_cost_usd, meta)
         VALUES ($1::timestamptz,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          row.ts,
          row.username,
          row.projectId ?? null,
          row.sessionId ?? null,
          row.kind,
          row.model ?? null,
          row.inputTokens ?? null,
          row.outputTokens ?? null,
          row.estCostUsd,
          JSON.stringify(row.meta ?? {}),
        ],
      );
    });
  } catch {
    /* file ok */
  }
}

function readFileRows(limit = 5000): UsageRow[] {
  try {
    if (!fs.existsSync(filePath())) return [];
    const lines = fs.readFileSync(filePath(), "utf8").trim().split("\n");
    return lines
      .slice(-limit)
      .map((l) => {
        try {
          return JSON.parse(l) as UsageRow;
        } catch {
          return null;
        }
      })
      .filter((x): x is UsageRow => Boolean(x));
  } catch {
    return [];
  }
}

export async function aggregateUsage(opts: {
  from?: string;
  to?: string;
  username?: string;
}): Promise<{
  rows: Array<{
    username: string;
    messages: number;
    inputTokens: number;
    outputTokens: number;
    estCostUsd: number;
  }>;
  totalEstCostUsd: number;
}> {
  let rows = readFileRows();
  try {
    if ((await checkRagDb()) === "up") {
      const pg = await withClient(async (client) => {
        const res = await client.query<{
          username: string;
          kind: string;
          input_tokens: number | null;
          output_tokens: number | null;
          est_cost_usd: string;
          ts: Date;
        }>(
          `SELECT username, kind, input_tokens, output_tokens, est_cost_usd, ts
           FROM usage_records
           WHERE ($1::timestamptz IS NULL OR ts >= $1::timestamptz)
             AND ($2::timestamptz IS NULL OR ts <= $2::timestamptz)
             AND ($3::text IS NULL OR username = $3)
           ORDER BY ts DESC
           LIMIT 10000`,
          [opts.from ?? null, opts.to ?? null, opts.username ?? null],
        );
        return res.rows.map((r) => ({
          username: r.username,
          kind: r.kind as UsageKind,
          inputTokens: r.input_tokens ?? 0,
          outputTokens: r.output_tokens ?? 0,
          estCostUsd: Number(r.est_cost_usd) || 0,
          ts: new Date(r.ts).toISOString(),
          projectId: undefined,
          sessionId: undefined,
        }));
      });
      if (pg.length) rows = pg as UsageRow[];
    }
  } catch {
    /* file */
  }

  const fromMs = opts.from ? Date.parse(opts.from) : 0;
  const toMs = opts.to ? Date.parse(opts.to) : Date.now() + 1e9;
  const map = new Map<
    string,
    {
      username: string;
      messages: number;
      inputTokens: number;
      outputTokens: number;
      estCostUsd: number;
    }
  >();

  for (const r of rows) {
    const t = Date.parse(r.ts);
    if (t < fromMs || t > toMs) continue;
    if (opts.username && r.username !== opts.username) continue;
    const cur = map.get(r.username) ?? {
      username: r.username,
      messages: 0,
      inputTokens: 0,
      outputTokens: 0,
      estCostUsd: 0,
    };
    if (r.kind === "message") cur.messages += 1;
    cur.inputTokens += r.inputTokens ?? 0;
    cur.outputTokens += r.outputTokens ?? 0;
    cur.estCostUsd += r.estCostUsd ?? 0;
    map.set(r.username, cur);
  }

  const list = [...map.values()].sort((a, b) =>
    a.username.localeCompare(b.username),
  );
  return {
    rows: list,
    totalEstCostUsd: list.reduce((s, x) => s + x.estCostUsd, 0),
  };
}
