import { Router } from 'express';
import { SocialProvider, ScheduledPostStatus } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import prisma from '../config/prisma';
import auth from '../middleware/auth';
import upload from '../middleware/upload';
import verifyCron from '../middleware/verifyCron';
import asyncHandler from '../utils/asyncHandler';
import HttpError from '../utils/httpError';
import { env } from '../config/env';
import { uploadMedia } from '../services/cloudinary.service';
import { getProviderConnectionStatus } from '../services/oauth.service';
import { processPosts } from '../services/scheduler.service';

const router = Router();

const createPostSchema = z.object({
  text: z.string().trim().min(1).max(2800),
  providers: z.array(z.nativeEnum(SocialProvider)).min(1),
  scheduledAt: z.coerce.date().refine((date) => date.getTime() > Date.now() - 60_000, 'scheduledAt must be now or in the future'),
  mediaUrls: z.array(z.string().url()).max(4).default([])
});

const generateSchema = z.object({
  brief: z.string().trim().min(10).max(2000),
  providers: z.array(z.nativeEnum(SocialProvider)).min(1).max(4)
});

router.get('/providers', auth, asyncHandler(async (_req, res) => {
  res.json({ ok: true, providers: getProviderConnectionStatus() });
}));

router.post('/generate', auth, asyncHandler(async (req, res) => {
  if (!env.GROQ_API_KEY) {
    throw new HttpError(503, 'GROQ_API_KEY is not configured on the backend');
  }

  const parsed = generateSchema.parse(req.body);

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: env.GROQ_MODEL,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write concise marketing posts for FlowFit, a home fitness SaaS. Return only valid JSON. The JSON shape must be {"variants":{"FACEBOOK":"...","INSTAGRAM":"...","LINKEDIN":"...","X":"..."}}. Only include requested platforms. X must be <= 280 characters. Instagram should include relevant hashtags. LinkedIn should be professional. Facebook should be friendly and conversion-oriented.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            brief: parsed.brief,
            platforms: parsed.providers
          })
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, 'Groq returned an empty response');

  let data: { variants?: Partial<Record<SocialProvider, string>> };
  try {
    data = JSON.parse(content);
  } catch {
    throw new HttpError(502, 'Groq returned invalid JSON');
  }

  res.json({ ok: true, variants: data.variants || {} });
}));

router.post('/media', auth, upload.array('media', 4), asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw new HttpError(400, 'Attach at least one media file');

  const urls = await Promise.all(files.map((file) => uploadMedia(file)));
  res.status(201).json({ ok: true, urls });
}));

router.post('/posts', auth, asyncHandler(async (req, res) => {
  const parsed = createPostSchema.parse(req.body);
  const post = await prisma.scheduledPost.create({
    data: {
      userId: req.user!.sub,
      text: parsed.text,
      mediaUrls: parsed.mediaUrls,
      providers: parsed.providers,
      scheduledAt: parsed.scheduledAt,
      status: ScheduledPostStatus.SCHEDULED
    }
  });

  res.status(201).json({ ok: true, post });
}));

router.get('/posts', auth, asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
  const where = {
    userId: req.user!.sub,
    ...(status && Object.values(ScheduledPostStatus).includes(status as ScheduledPostStatus)
      ? { status: status as ScheduledPostStatus }
      : {})
  };

  const posts = await prisma.scheduledPost.findMany({
    where,
    orderBy: { scheduledAt: 'desc' },
    take: 100
  });

  res.json({ ok: true, posts });
}));

router.patch('/posts/:id/cancel', auth, asyncHandler(async (req, res) => {
  const post = await prisma.scheduledPost.findFirst({ where: { id: req.params.id, userId: req.user!.sub } });
  if (!post) throw new HttpError(404, 'Scheduled post not found');

  const cancellableStatuses: ScheduledPostStatus[] = [
    ScheduledPostStatus.DRAFT,
    ScheduledPostStatus.SCHEDULED,
    ScheduledPostStatus.FAILED
  ];

  if (!cancellableStatuses.includes(post.status)) {
    throw new HttpError(409, `Cannot cancel a post with status ${post.status}`);
  }

  const updated = await prisma.scheduledPost.update({
    where: { id: post.id },
    data: { status: ScheduledPostStatus.CANCELLED }
  });

  res.json({ ok: true, post: updated });
}));

router.post('/cron/publish-due', verifyCron, asyncHandler(async (_req, res) => {
  const summary = await processPosts();
  res.json({ ok: true, summary });
}));

export default router;
