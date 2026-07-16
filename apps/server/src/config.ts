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
  workspacesRoot: resolveWorkspacesRoot(),
  auditDir: path.resolve(projectRoot, "data/audit"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  passwords: {
    admin: process.env.ADMIN_PASSWORD ?? "admin123",
    user1: process.env.USER1_PASSWORD ?? "user1",
    user2: process.env.USER2_PASSWORD ?? "user2",
  },
};
