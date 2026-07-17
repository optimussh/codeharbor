import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config();

function resolveWorkspacesRoot(): string {
  const raw = process.env.WORKSPACES_ROOT ?? "./data/workspaces";
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
}

export const config = {
  projectRoot,
  port: Number(process.env.PORT ?? 3000),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-secret",
  opencodeBaseUrl: process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096",
  opencodeBin: process.env.OPENCODE_BIN ?? "opencode",
  opencodeManaged: (process.env.OPENCODE_MANAGED ?? "true") === "true",
  /** OpenCode / models.dev provider id for Gemini API */
  opencodeProviderId: process.env.OPENCODE_PROVIDER_ID ?? "google",
  opencodeModelId: process.env.OPENCODE_MODEL_ID ?? "gemini-2.0-flash",
  workspacesRoot: resolveWorkspacesRoot(),
  auditDir: path.resolve(projectRoot, "data/audit"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://vibe:vibe@127.0.0.1:5433/vibe",
  ragEnabled: (process.env.RAG_ENABLED ?? "true") === "true",
  ragTopK: Number(process.env.RAG_TOP_K ?? 5),
  ragChunkSize: Number(process.env.RAG_CHUNK_SIZE ?? 1200),
  ragChunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP ?? 150),
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-004",
  embeddingDims: 768,
  /** Upstream OpenChamber web (optional) e.g. http://127.0.0.1:4097 */
  openchamberUrl: process.env.OPENCHAMBER_URL ?? "",
  openchamberEnabled: (process.env.OPENCHAMBER_ENABLED ?? "false") === "true",
  /** Daily message quota per user (0 = unlimited) */
  dailyMessageQuota: Number(process.env.DAILY_MESSAGE_QUOTA ?? 200),
  passwords: {
    admin: process.env.ADMIN_PASSWORD ?? "admin123",
    user1: process.env.USER1_PASSWORD ?? "user1",
    user2: process.env.USER2_PASSWORD ?? "user2",
  },
};
