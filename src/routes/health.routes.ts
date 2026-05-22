import { Router } from 'express';
import prisma from '../config/prisma';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  res.json({ ok: true, service: 'flowfit-social-server', timestamp: new Date().toISOString() });
}));

router.get('/db', asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, database: 'reachable', timestamp: new Date().toISOString() });
}));

export default router;
