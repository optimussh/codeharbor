import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { chunkText } from "./chunk.js";
import { embedText, vectorToSql } from "./embed.js";
import { withClient, checkRagDb } from "./db.js";

export interface DocumentRow {
  id: string;
  username: string;
  filename: string;
  mime: string | null;
  byte_size: number;
  created_at: Date;
  chunk_count?: number;
}

export interface SearchHit {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export async function ingestDocument(opts: {
  username: string;
  filename: string;
  mime?: string;
  text: string;
}): Promise<{ documentId: string; chunks: number; embedProvider: string }> {
  if ((await checkRagDb()) !== "up") {
    throw Object.assign(new Error("RAG database is down"), { status: 503 });
  }

  const pieces = chunkText(
    opts.text,
    config.ragChunkSize,
    config.ragChunkOverlap,
  );
  if (pieces.length === 0) {
    throw Object.assign(new Error("Empty document"), { status: 400 });
  }

  const documentId = randomUUID();
  let embedProvider = "local";

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO documents (id, username, filename, mime, byte_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          documentId,
          opts.username,
          opts.filename,
          opts.mime ?? "text/plain",
          Buffer.byteLength(opts.text, "utf8"),
        ],
      );

      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i]!;
        const { vector, provider } = await embedText(piece);
        embedProvider = provider;
        const chunkId = randomUUID();
        await client.query(
          `INSERT INTO chunks (id, document_id, username, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4, $5, $6::vector)`,
          [
            chunkId,
            documentId,
            opts.username,
            i,
            piece,
            vectorToSql(vector),
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });

  return { documentId, chunks: pieces.length, embedProvider };
}

export async function listDocuments(username: string): Promise<DocumentRow[]> {
  if ((await checkRagDb()) !== "up") {
    throw Object.assign(new Error("RAG database is down"), { status: 503 });
  }
  return withClient(async (client) => {
    const res = await client.query<DocumentRow>(
      `SELECT d.id, d.username, d.filename, d.mime, d.byte_size, d.created_at,
              COUNT(c.id)::int AS chunk_count
       FROM documents d
       LEFT JOIN chunks c ON c.document_id = d.id
       WHERE d.username = $1
       GROUP BY d.id
       ORDER BY d.created_at DESC`,
      [username],
    );
    return res.rows;
  });
}

export async function deleteDocument(
  username: string,
  documentId: string,
): Promise<boolean> {
  if ((await checkRagDb()) !== "up") {
    throw Object.assign(new Error("RAG database is down"), { status: 503 });
  }
  return withClient(async (client) => {
    const res = await client.query(
      `DELETE FROM documents WHERE id = $1 AND username = $2`,
      [documentId, username],
    );
    return (res.rowCount ?? 0) > 0;
  });
}

export async function searchChunks(
  username: string,
  query: string,
  topK = config.ragTopK,
): Promise<SearchHit[]> {
  if ((await checkRagDb()) !== "up") {
    throw Object.assign(new Error("RAG database is down"), { status: 503 });
  }

  const { vector } = await embedText(query);

  return withClient(async (client) => {
    const res = await client.query<{
      chunk_id: string;
      document_id: string;
      filename: string;
      content: string;
      chunk_index: number;
      distance: number;
    }>(
      `SELECT c.id AS chunk_id,
              c.document_id,
              d.filename,
              c.content,
              c.chunk_index,
              (c.embedding <=> $1::vector) AS distance
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE c.username = $2
       ORDER BY c.embedding <=> $1::vector
       LIMIT $3`,
      [vectorToSql(vector), username, topK],
    );

    return res.rows.map((r) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      filename: r.filename,
      content: r.content,
      chunkIndex: r.chunk_index,
      // cosine distance → similarity score 0..1-ish
      score: Math.max(0, 1 - Number(r.distance)),
    }));
  });
}

export function formatRagContext(hits: SearchHit[]): string {
  if (hits.length === 0) return "";
  const blocks = hits.map(
    (h, i) =>
      `[#${i + 1} source=${h.filename} score=${h.score.toFixed(3)}]\n${h.content}`,
  );
  return [
    "아래는 사용자 문서에서 검색된 근거입니다. 답변 시 가능하면 근거를 인용하세요.",
    "----- RAG CONTEXT -----",
    ...blocks,
    "----- END RAG CONTEXT -----",
    "",
  ].join("\n");
}
