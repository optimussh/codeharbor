-- Phase 3 RAG (local mini)
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

-- cosine distance search (created after some rows may exist; IF NOT EXISTS for HNSW needs pg16+)
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
    -- HNSW may fail on empty table in some versions; create later
    RAISE NOTICE 'hnsw index skipped: %', SQLERRM;
END $$;
