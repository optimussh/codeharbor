import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureOpencodeRunning, stopOpencode } from "./opencode/process.js";
import { ensureSchema, closePool, checkRagDb } from "./rag/db.js";
import { ensurePlatformSchema } from "./db/platformSchema.js";
import * as sessionMap from "./sessionMap.js";
import { stopAllPreviews } from "./preview/manager.js";
import { resolveGeminiKey } from "./credentials/vault.js";
import fs from "node:fs";

fs.mkdirSync(config.workspacesRoot, { recursive: true });
fs.mkdirSync(config.projectsRoot, { recursive: true });
fs.mkdirSync(config.auditDir, { recursive: true });
fs.mkdirSync(config.templatesRoot, { recursive: true });
fs.mkdirSync(config.steeringRoot, { recursive: true });
fs.mkdirSync(config.specsRoot, { recursive: true });

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[server] portal     http://127.0.0.1:${config.port}/`);
  console.log(
    `[server] chamber    http://127.0.0.1:${config.port}/chamber  → ${config.openchamberUrl} (${config.openchamberEnabled ? "on" : "off"})`,
  );
  console.log(
    `[server] opencode   proxy /opencode  → ${config.opencodeBaseUrl}`,
  );
  console.log(`[server] legacy ui  http://127.0.0.1:5173`);
  console.log(`[server] workspaces ${config.workspacesRoot}`);
  console.log(
    `[server] llm: ${resolveGeminiKey() ? "key configured (env/vault)" : "LLM key missing"}`,
  );
  console.log(`[server] admin     http://127.0.0.1:${config.port}/admin`);
  console.log(
    `[server] oidc: ${config.oidc.enabled ? "enabled" : "off"} · sandbox: ${config.sandboxEnabled ? "on" : "off"}`,
  );
  void ensureOpencodeRunning();
  void (async () => {
    await ensureSchema();
    await ensurePlatformSchema();
    console.log(`[server] rag: ${await checkRagDb()}`);
    await sessionMap.loadFromPostgres();
  })();
});

function shutdown() {
  console.log("[server] shutting down...");
  stopAllPreviews();
  stopOpencode();
  void closePool();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
