import pg from "pg";
import { config } from "../config.js";
import fs from "node:fs";
import path from "node:path";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let ready: boolean | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 3000,
    });
  }
  return pool;
}

export async function checkRagDb(): Promise<"up" | "down" | "disabled"> {
  if (!config.ragEnabled) return "disabled";
  try {
    const client = await getPool().connect();
    try {
      await client.query("SELECT 1");
      await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      ready = true;
      return "up";
    } finally {
      client.release();
    }
  } catch {
    ready = false;
    return "down";
  }
}

export async function ensureSchema(): Promise<void> {
  if (!config.ragEnabled) return;
  const status = await checkRagDb();
  if (status !== "up") {
    console.warn("[rag] database not available — start: docker compose up -d");
    return;
  }

  const initPath = path.join(
    config.projectRoot,
    "deploy/postgres/init.sql",
  );
  const sql = fs.existsSync(initPath)
    ? fs.readFileSync(initPath, "utf8")
    : `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

  const client = await getPool().connect();
  try {
    await client.query(sql);
    console.log("[rag] schema ready");
  } finally {
    client.release();
  }
}

export async function withClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function isRagReady(): boolean {
  return ready === true;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
