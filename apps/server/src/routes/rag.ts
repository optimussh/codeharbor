import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/requireAuth.js";
import {
  deleteDocument,
  ingestDocument,
  listDocuments,
  searchChunks,
} from "../rag/store.js";
import { checkRagDb } from "../rag/db.js";
import { appendAudit } from "../audit.js";
import { config } from "../config.js";

export const ragRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const TEXT_EXT = /\.(txt|md|markdown|csv|json|log|ts|tsx|js|jsx|py|yml|yaml)$/i;

ragRouter.get("/rag/status", requireAuth, async (_req, res) => {
  const status = await checkRagDb();
  res.json({
    rag: status,
    databaseUrlHost: safeHost(config.databaseUrl),
    embedding:
      config.geminiApiKey.trim()
        ? { mode: "gemini", model: config.embeddingModel }
        : { mode: "local", model: "hash-bow-768" },
  });
});

ragRouter.get("/rag/documents", requireAuth, async (req, res) => {
  try {
    const docs = await listDocuments(req.session.user!.username);
    res.json({ documents: docs });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

ragRouter.post(
  "/rag/documents",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const username = req.session.user!.username;
      let filename = String(req.body?.filename ?? "").trim();
      let text = String(req.body?.text ?? "");
      let mime = String(req.body?.mime ?? "text/plain");

      if (req.file) {
        filename = filename || req.file.originalname || "upload.txt";
        mime = req.file.mimetype || mime;
        if (!TEXT_EXT.test(filename) && !mime.startsWith("text/")) {
          res.status(400).json({
            error:
              "Only text-like files supported in local RAG mini (.txt .md .csv .json .ts …)",
          });
          return;
        }
        text = req.file.buffer.toString("utf8");
      }

      if (!filename) {
        res.status(400).json({ error: "filename required" });
        return;
      }
      if (!text.trim()) {
        res.status(400).json({ error: "empty content" });
        return;
      }
      if (text.length > 500_000) {
        res.status(400).json({ error: "document too large (max ~500KB text)" });
        return;
      }

      const result = await ingestDocument({
        username,
        filename,
        mime,
        text,
      });
      appendAudit("rag.ingest", username, {
        documentId: result.documentId,
        filename,
        chunks: result.chunks,
      });
      res.status(201).json(result);
    } catch (e) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message });
    }
  },
);

ragRouter.delete("/rag/documents/:id", requireAuth, async (req, res) => {
  try {
    const username = req.session.user!.username;
    const ok = await deleteDocument(username, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    appendAudit("rag.delete", username, { documentId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

ragRouter.post("/rag/search", requireAuth, async (req, res) => {
  try {
    const username = req.session.user!.username;
    const query = String(req.body?.query ?? "").trim();
    if (!query) {
      res.status(400).json({ error: "query required" });
      return;
    }
    const topK = Math.min(
      Number(req.body?.topK ?? config.ragTopK) || config.ragTopK,
      20,
    );
    const hits = await searchChunks(username, query, topK);
    appendAudit("rag.search", username, { topK, hitCount: hits.length });
    res.json({ hits });
  } catch (e) {
    const err = e as Error & { status?: number };
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

function safeHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}`;
  } catch {
    return "invalid";
  }
}
