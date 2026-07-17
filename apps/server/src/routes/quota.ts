import { Router } from "express";
import { requireAuth } from "../auth/requireAuth.js";
import { getQuota } from "../quota.js";

export const quotaRouter = Router();

quotaRouter.get("/quota", requireAuth, (req, res) => {
  res.json(getQuota(req.session.user!.username));
});
