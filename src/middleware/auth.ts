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

export default function auth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

  if (!token) {
    throw new HttpError(401, 'Missing bearer token');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (!decoded.sub) throw new Error('Missing subject');
    req.user = decoded;
    next();
  } catch {
    throw new HttpError(401, 'Invalid or expired bearer token');
  }
}
