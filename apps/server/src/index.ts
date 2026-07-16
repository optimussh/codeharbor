import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureOpencodeRunning, stopOpencode } from "./opencode/process.js";
import { ensureSchema, closePool, checkRagDb } from "./rag/db.js";
import fs from "node:fs";

fs.mkdirSync(config.workspacesRoot, { recursive: true });
fs.mkdirSync(config.auditDir, { recursive: true });

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[server] http://127.0.0.1:${config.port}`);
  console.log(`[server] workspaces: ${config.workspacesRoot}`);
  console.log(
    `[server] llm: ${config.geminiApiKey ? "GEMINI_API_KEY set" : "GEMINI_API_KEY missing"}`,
  );
  void ensureOpencodeRunning();
  void (async () => {
    await ensureSchema();
    console.log(`[server] rag: ${await checkRagDb()}`);
  })();
});

function shutdown() {
  console.log("[server] shutting down...");
  stopOpencode();
  void closePool();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
