import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { pinoHttp } from "pino-http";
import { createSessionMiddleware } from "./auth/session.js";
import { authRouter } from "./auth/routes.js";
import { healthRouter } from "./routes/health.js";
import { sessionsRouter } from "./routes/sessions.js";
import { fsRouter } from "./routes/fs.js";
import { eventsRouter } from "./routes/events.js";
import { adminRouter } from "./routes/admin.js";
import { workspaceRouter } from "./routes/workspace.js";
import { workspaceBindRouter } from "./routes/workspaceBind.js";
import { ragRouter } from "./routes/rag.js";
import { portalRouter } from "./routes/portal.js";
import { loginPageRouter } from "./routes/loginPage.js";
import { quotaRouter } from "./routes/quota.js";
import { stackRouter } from "./routes/stack.js";
import { previewRouter, mountPreviewProxy } from "./routes/preview.js";
import { gitRouter } from "./routes/git.js";
import { uploadRouter } from "./routes/upload.js";
import { proxyRouter, mountOpenChamberProxy } from "./routes/proxy.js";
import { projectsRouter } from "./routes/projects.js";
import { sandboxRouter } from "./routes/sandbox.js";
import { templatesRouter } from "./routes/templates.js";
import { specsRouter } from "./routes/specs.js";
import { steeringRouter } from "./routes/steering.js";
import { adminPageRouter } from "./routes/adminPage.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import * as sessionMap from "./sessionMap.js";
import { bootstrapUserWorkspace } from "./workspaceBootstrap.js";
import { config } from "./config.js";
import { publicUserList } from "./users.js";
import { log, requestId } from "./log.js";
import { bootstrapCredentialsFromEnv } from "./credentials/vault.js";
import { aggregateUsage } from "./usage.js";
import { requireAuth } from "./auth/requireAuth.js";

export interface CreateAppOptions {
  managedOpencode?: boolean;
}

export function createApp(_options: CreateAppOptions = {}) {
  sessionMap.loadFromDisk();
  bootstrapCredentialsFromEnv();
  for (const u of publicUserList()) {
    bootstrapUserWorkspace(u.username);
  }

  const app = express();

  app.use(
    pinoHttp({
      logger: log,
      genReqId: (req) =>
        (req.headers["x-request-id"] as string) || requestId(),
      autoLogging: {
        ignore: (req) => req.url === "/api/ping" || req.url === "/api/stack",
      },
    }),
  );

  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(createSessionMiddleware());
  app.use("/api", apiLimiter);

  app.use(
    "/docs/status",
    express.static(path.join(config.projectRoot, "docs/status")),
  );

  app.get("/api/ping", (_req, res) => {
    res.json({
      ok: true,
      openchamber: {
        enabled: config.openchamberEnabled,
        url: config.openchamberUrl || null,
      },
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", healthRouter);
  app.use("/api", sessionsRouter);
  app.use("/api", fsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", adminRouter);
  app.use("/api", workspaceRouter);
  app.use("/api", workspaceBindRouter);
  app.use("/api", ragRouter);
  app.use("/api", quotaRouter);
  app.use("/api", stackRouter);
  app.use("/api", previewRouter);
  app.use("/api", gitRouter);
  app.use("/api", uploadRouter);
  app.use("/api", projectsRouter);
  app.use("/api", sandboxRouter);
  app.use("/api", templatesRouter);
  app.use("/api", specsRouter);
  app.use("/api", steeringRouter);

  app.get("/api/usage/me", requireAuth, async (req, res) => {
    const username = req.session.user!.username;
    const from = new Date(Date.now() - 30 * 864e5).toISOString();
    const agg = await aggregateUsage({ username, from });
    res.json(agg);
  });

  app.use(proxyRouter);
  mountOpenChamberProxy(app);
  mountPreviewProxy(app);

  app.use(loginPageRouter);
  app.use(adminPageRouter);
  app.use(portalRouter);

  return app;
}
