-- Phase 3 RAG + platform state (local)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_username_idx ON documents (username);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_username_idx ON chunks (username);
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'chunks_embedding_hnsw_idx'
  ) THEN
    CREATE INDEX chunks_embedding_hnsw_idx
      ON chunks
      USING hnsw (embedding vector_cosine_ops);
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'hnsw index skipped: %', SQLERRM;
END $$;

-- Platform: agent session ownership
CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  workspace TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS agent_sessions_username_idx ON agent_sessions (username);

-- Platform: audit log
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  username TEXT,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS audit_events_ts_idx ON audit_events (ts DESC);
CREATE INDEX IF NOT EXISTS audit_events_username_idx ON audit_events (username);

-- CodeHarbor platform (also auto-migrated at server start)
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
