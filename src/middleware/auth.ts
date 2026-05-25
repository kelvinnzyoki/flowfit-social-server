import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import HttpError from '../utils/httpError';

type JwtPayload = { sub: string; email?: string; role?: string };

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  return raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export default function auth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  const cookieToken =
    readCookie(req, 'flowfit_access_token') ||
    readCookie(req, 'access_token') ||
    readCookie(req, 'token');

  const token = bearerToken || cookieToken;

  // ── No token at all → poster-service bypass ──────────────────────────────
  if (!token && env.POSTER_SERVICE_USER_ID) {
    req.user = { sub: env.POSTER_SERVICE_USER_ID, role: 'poster-service' };
    return next();
  }

  if (!token) {
    throw new HttpError(401, 'Missing authenticated FlowFit session');
  }

  // ── Static poster token check (VITE_API_TOKEN on frontend must match POSTER_API_TOKEN on backend) ──
  if (env.POSTER_API_TOKEN && token === env.POSTER_API_TOKEN) {
    const userId = env.POSTER_SERVICE_USER_ID || 'poster-service';
    req.user = { sub: userId, role: 'poster-service' };
    return next();
  }

  // ── Full JWT verification (normal FlowFit session) ───────────────────────
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded.sub) throw new Error('Missing subject');
    req.user = decoded;
    next();
  } catch {
    throw new HttpError(401, 'Invalid or expired FlowFit session');
  }
}
