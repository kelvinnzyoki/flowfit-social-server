import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
    const cookieToken = req.cookies?.token || req.cookies?.accessToken;
    const token = bearer || cookieToken;

    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; email?: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user) return res.status(401).json({ ok: false, error: "User not found" });
      req.user = { id: user.id, email: user.email };
      return next();
    }

    // Dev fallback keeps the poster frontend usable before you connect full auth.
    if (env.NODE_ENV !== "production") {
      const user = await prisma.user.upsert({
        where: { email: "dev@flowfit.local" },
        update: {},
        create: { email: "dev@flowfit.local", name: "FlowFit Dev" }
      });
      req.user = { id: user.id, email: user.email };
      return next();
    }

    return res.status(401).json({ ok: false, error: "Authentication required" });
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired session" });
  }
}
