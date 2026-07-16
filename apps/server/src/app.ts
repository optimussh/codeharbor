import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createSessionMiddleware } from "./auth/session.js";
import { authRouter } from "./auth/routes.js";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
import { fsRouter } from "./routes/fs.js";
import { eventsRouter } from "./routes/events.js";
import { adminRouter } from "./routes/admin.js";
import { workspaceRouter } from "./routes/workspace.js";
import * as sessionMap from "./sessionMap.js";
import { ensureWorkspace } from "./workspace.js";
import { config } from "./config.js";
import { publicUserList } from "./users.js";

export interface CreateAppOptions {
  /** reserved for tests — skip managed process side effects */
  managedOpencode?: boolean;
}

export function createApp(_options: CreateAppOptions = {}) {
  // Ensure seed workspaces + load ownership map (Phase 1)
  sessionMap.loadFromDisk();
  for (const u of publicUserList()) {
    ensureWorkspace(config.workspacesRoot, u.username);
  }

  const app = express();

  app.use(
    cors({
      origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());

  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", healthRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", fsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", adminRouter);
  app.use("/api", workspaceRouter);

  return app;
}
