import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { getHealth } from "../opencode/client.js";

export const healthRouter = Router();

healthRouter.get("/health", requireAuth, async (_req, res) => {
  const health = await getHealth();
  res.json(health);
});
