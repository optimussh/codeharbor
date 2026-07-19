import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config();

function resolvePath(raw: string, fallback: string): string {
  const v = process.env[raw] ?? fallback;
  return path.isAbsolute(v) ? v : path.resolve(projectRoot, v);
}

function resolveWorkspacesRoot(): string {
  return resolvePath("WORKSPACES_ROOT", "./data/workspaces");
}

export const config = {
  projectRoot,
  port: Number(process.env.PORT ?? 5300),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-secret",
  opencodeBaseUrl: process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096",
  opencodeBin: process.env.OPENCODE_BIN ?? "opencode",
  opencodeManaged: (process.env.OPENCODE_MANAGED ?? "true") === "true",
  /** OpenCode / models.dev provider id for Gemini API */
  opencodeProviderId: process.env.OPENCODE_PROVIDER_ID ?? "google",
  opencodeModelId: process.env.OPENCODE_MODEL_ID ?? "gemini-2.0-flash",
  workspacesRoot: resolveWorkspacesRoot(),
  projectsRoot: resolvePath("PROJECTS_ROOT", "./data/projects"),
  templatesRoot: resolvePath("TEMPLATES_ROOT", "./data/templates"),
  steeringRoot: resolvePath("STEERING_ROOT", "./data/steering"),
  specsRoot: resolvePath("SPECS_ROOT", "./data/specs"),
  auditDir: path.resolve(projectRoot, "data/audit"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  credentialsMasterKey:
    process.env.CREDENTIALS_MASTER_KEY ??
    "dev-only-change-me-32bytes-key!!!!",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://vibe:vibe@127.0.0.1:5433/vibe",
  ragEnabled: (process.env.RAG_ENABLED ?? "true") === "true",
  ragTopK: Number(process.env.RAG_TOP_K ?? 5),
  ragChunkSize: Number(process.env.RAG_CHUNK_SIZE ?? 1200),
  ragChunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP ?? 150),
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-004",
  embeddingDims: 768,
  /** Upstream OpenChamber web — local default :3001 */
  openchamberUrl:
    process.env.OPENCHAMBER_URL ?? "http://127.0.0.1:3001",
  openchamberEnabled: (process.env.OPENCHAMBER_ENABLED ?? "true") === "true",
  /** Daily message quota per user (0 = unlimited) */
  dailyMessageQuota: Number(process.env.DAILY_MESSAGE_QUOTA ?? 200),
  costInputPer1M: Number(process.env.COST_INPUT_PER_1M_USD ?? 0.1),
  costOutputPer1M: Number(process.env.COST_OUTPUT_PER_1M_USD ?? 0.4),
  costEmbedPer1M: Number(process.env.COST_EMBED_PER_1M_USD ?? 0.01),
  sandboxEnabled: (process.env.SANDBOX_ENABLED ?? "true") === "true",
  sandboxImage: process.env.SANDBOX_IMAGE ?? "node:22-bookworm",
  sandboxMemory: process.env.SANDBOX_MEMORY ?? "2g",
  sandboxCpus: process.env.SANDBOX_CPUS ?? "2",
  sandboxDefaultNetwork: process.env.SANDBOX_DEFAULT_NETWORK ?? "none",
  oidc: {
    enabled: (process.env.OIDC_ENABLED ?? "false") === "true",
    issuer: process.env.OIDC_ISSUER ?? "",
    clientId: process.env.OIDC_CLIENT_ID ?? "",
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.OIDC_REDIRECT_URI ??
      "http://127.0.0.1:5300/api/auth/oidc/callback",
    adminGroup: process.env.OIDC_ADMIN_GROUP ?? "",
    groupsClaim: process.env.OIDC_GROUPS_CLAIM ?? "groups",
  },
  authAllowLocal: (process.env.AUTH_ALLOW_LOCAL ?? "true") === "true",
  passwords: {
    admin: process.env.ADMIN_PASSWORD ?? "admin123",
    user1: process.env.USER1_PASSWORD ?? "user1",
    user2: process.env.USER2_PASSWORD ?? "user2",
  },
};
