import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const querySecret = typeof req.query.secret === "string" ? req.query.secret : "";
  if (bearer === env.CRON_SECRET || querySecret === env.CRON_SECRET) return next();
  return res.status(401).json({ ok: false, error: "Invalid cron secret" });
}
