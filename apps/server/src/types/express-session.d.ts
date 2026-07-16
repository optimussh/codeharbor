import type { AuthUser } from "../types.js";

declare module "express-session" {
  interface SessionData {
    user?: AuthUser;
  }
}
