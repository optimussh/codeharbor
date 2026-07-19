import { checkRagDb, withClient } from "../rag/db.js";
import { log } from "../log.js";

const DDL = `
CREATE TABLE IF NOT EXISTS app_users (
  username      TEXT PRIMARY KEY,
  display_name  TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  password_hash TEXT,
  disabled      BOOLEAN NOT NULL DEFAULT false,
  daily_quota   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  email         TEXT,
  raw_claims    JSONB,
  UNIQUE (provider, subject)
);

CREATE TABLE IF NOT EXISTS api_credentials (
  provider      TEXT PRIMARY KEY,
  ciphertext    TEXT NOT NULL,
  iv            TEXT NOT NULL,
  tag           TEXT NOT NULL,
  last4         TEXT NOT NULL,
  updated_by    TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  root_path     TEXT NOT NULL,
  created_by    TEXT NOT NULL,
  sandbox_mode  TEXT NOT NULL DEFAULT 'off',
  network_mode  TEXT NOT NULL DEFAULT 'none',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  username      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'developer',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, username)
);

CREATE TABLE IF NOT EXISTS usage_records (
  id            BIGSERIAL PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  username      TEXT NOT NULL,
  project_id    TEXT,
  session_id    TEXT,
  kind          TEXT NOT NULL,
  model         TEXT,
  input_tokens  INT,
  output_tokens INT,
  est_cost_usd  NUMERIC(12, 6),
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS usage_records_user_ts_idx ON usage_records (username, ts DESC);
CREATE INDEX IF NOT EXISTS usage_records_ts_idx ON usage_records (ts DESC);

CREATE TABLE IF NOT EXISTS specs (
  id            TEXT PRIMARY KEY,
  project_id    TEXT,
  username      TEXT NOT NULL,
  title         TEXT NOT NULL,
  requirements  TEXT NOT NULL DEFAULT '',
  design        TEXT NOT NULL DEFAULT '',
  tasks_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function ensurePlatformSchema(): Promise<void> {
  try {
    if ((await checkRagDb()) !== "up") {
      log.warn("platform schema skipped — database down");
      return;
    }
    await withClient(async (client) => {
      await client.query(DDL);
    });
    log.info("platform schema ensured");
  } catch (err) {
    log.warn({ err }, "platform schema ensure failed");
  }
}
