import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import HttpError from '../utils/httpError';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default function verifyCron(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : '';
  const headerSecret = typeof req.headers['x-cron-secret'] === 'string' ? req.headers['x-cron-secret'] : '';
  const provided = bearer || headerSecret;

  if (!provided || !safeEqual(provided, env.CRON_SECRET)) {
    throw new HttpError(401, 'Unauthorized cron request');
  }

  next();
}
