import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
};
