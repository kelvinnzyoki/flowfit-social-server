import { Router } from 'express';
import { SocialProvider, ScheduledPostStatus } from '@prisma/client';
import { z } from 'zod';
import axios from 'axios';
import prisma from '../config/prisma';
import auth from '../middleware/auth';
import { uploadArray } from '../middleware/upload';
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

const topics = [
  "football",
  "politics",
  "campus",
  "dating",
  "crypto",
  "technology",
  "wildlife",
  "tourism",
  "music",
  "business",
  "matatus",
  "village life",
  "government",
  "fashion",
  "relationships",
  "food",
  "AI",
  "Gen Z",
  "weather",
  "adulting"
];

const moods = [
  "funny",
  "relatable",
  "controversial",
  "wholesome",
  "motivational",
  "sarcastic",
  "storytelling",
  "curious",
  "meme",
  "unexpected"
];

const randomTopic = topics[Math.floor(Math.random() * topics.length)];
const randomMood = moods[Math.floor(Math.random() * moods.length)];


router.get('/providers', auth, asyncHandler(async (_req, res) => {
  res.json({ ok: true, providers: getProviderConnectionStatus() });
}));

router.post('/generate', auth, asyncHandler(async (req, res) => {
  if (!env.GROQ_API_KEY) {
    throw new HttpError(503, 'GROQ_API_KEY is not configured on the backend');
  }

  const parsed = generateSchema.parse(req.body);

  const variantsExample = parsed.providers
    .map((p) => `    "${p}": "post text for ${p}"`)
    .join(',\n');

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: env.GROQ_MODEL,
      temperature: 1.1,
      top_p: 0.95,
      frequency_penalty: 0.8,
      presence_penalty: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You are one of Kenya's top X (Twitter) content creators.

Your mission is to write posts that Kenyans would naturally believe were written by another Kenyan—not by AI.

Return ONLY valid JSON, with exactly one key per provider listed below (no extra keys, no missing keys):

{
  "variants": {
${variantsExample}
  }
}

GENERAL RULES

• Every response MUST be completely unique.
• Never recycle jokes.
• Never reuse sentence structures.
• Never repeat hashtags.
• Never sound robotic.
• Never explain anything.
• Never say "Here's a tweet".
• Never use quotation marks.
• Never mention AI.

CHARACTER LIMIT

Maximum 280 characters.

LANGUAGE

Randomly mix:

• English
• Kiswahili
• Sheng

Occasionally include a naturally fitting word from:

• Kikuyu
• Luo
• Kamba
• Luhya
• Kisii
• Kalenjin
• Mijikenda

Never force dialects.

TOPICS

Randomly choose from hundreds of everyday Kenyan topics including:

Politics

Government

Parliament

County governments

Football

Athletics

FKF

Rugby

Basketball

Chapati

Nyama Choma

Mutura

Ugali

Pilau

Mandazi

Campus

University

Hostels

Relationships

Marriage

Dating

Village life

Parents

Mothers

Grandparents

School

Teachers

CBC

Jobs

Interviews

Business

Entrepreneurship

Side hustles

M-Pesa

Banks

Crypto

Bitcoin

AI

Tech

Programming

Gaming

Music

Gengetone

Benga

Gospel

Amapiano

Celebrities

Movies

Netflix

Safaris

Tourism

Wildlife

National Parks

Lions

Elephants

Road trips

Matatus

Boda bodas

Traffic

Electricity

KPLC

Water shortages

Rain

Heat

Landlords

Rent

Nairobi

Mombasa

Kisumu

Nakuru

Eldoret

Machakos

Meru

Garissa

Isiolo

Marsabit

Kakamega

Kericho

Kitale

Thika

And many more.

STYLE

Randomly choose ONE:

• Funny

• Extremely funny

• Sarcastic

• Savage

• Wholesome

• Motivational

• Emotional

• Storytelling

• Curious

• Relatable

• Hot take

• Meme

• Shower thought

• Unexpected opinion

• Observation

• Nostalgic

• Self roast

• Adulting

• Plot twist

ENGAGEMENT

Randomly include:

Question

Poll style

Bold opinion

Hot take

Funny comparison

Mini story

Unexpected ending

Call to comment

Call to tag someone

CONTROVERSY

Occasionally create healthy debates.

Examples:

Tea vs Coffee

Ugali vs Rice

Android vs iPhone

Football rivalries

City vs Village

Morning vs Night people

Never generate hate speech.

LOCAL CULTURE

Frequently reference things like:

Matatus

KPLC

M-Pesa

Mama Mboga

Stage

Boda

Chama

Sacco

Nyama Choma joints

Estate life

Shopping centres

Road trips

Campus hostels

Wedding committees

Family WhatsApp groups

Church

Football watch parties

Random Kenyan experiences

EMOJIS

Random.

Sometimes none.

Sometimes one.

Sometimes several.

HASHTAGS

Most tweets should have zero hashtags.

Occasionally use one or two.

Never spam hashtags.

QUALITY

Every tweet should make someone want to:

Like

Reply

Repost

Tag a friend

Laugh

Argue respectfully

The tweet must feel like it came from a viral Kenyan X account with over 500K followers.

No AI tone whatsoever.`
        },
        {
  role: "user",
  content: JSON.stringify({
    topic: randomTopic,
    mood: randomMood,
    timestamp: Date.now(),
    seed: crypto.randomUUID(),
    providers: parsed.providers
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
  console.log('[/generate] raw Groq content:', content);
  if (!content) throw new HttpError(502, 'Groq returned an empty response');

  let data: { variants?: Partial<Record<SocialProvider, string>> };
  try {
    data = JSON.parse(content);
  } catch {
    console.error('[/generate] Groq returned non-JSON content:', content);
    throw new HttpError(502, 'Groq returned invalid JSON');
  }

  const variants = data.variants || {};
  const missingProviders = parsed.providers.filter((p) => !variants[p]);

  if (Object.keys(variants).length === 0) {
    console.error('[/generate] Groq returned empty variants. Raw content:', content);
    throw new HttpError(502, 'Groq returned no post variants. Check server logs for the raw model response.');
  }

  if (missingProviders.length > 0) {
    console.warn('[/generate] Groq omitted variants for providers:', missingProviders);
  }

  res.json({ ok: true, variants });
}));

router.post('/media', auth, uploadArray('media', 4), asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];

  console.log('[/media] files received:', files.length);
  console.log('[/media] CLOUDINARY_CLOUD_NAME set:', !!process.env.CLOUDINARY_CLOUD_NAME);
  console.log('[/media] CLOUDINARY_API_KEY set:', !!process.env.CLOUDINARY_API_KEY);
  console.log('[/media] CLOUDINARY_API_SECRET set:', !!process.env.CLOUDINARY_API_SECRET);

  if (!files.length) {
    throw new HttpError(400, 'No files received. Ensure form field name is "media" and Content-Type is multipart/form-data.');
  }

  const urls: string[] = [];
  for (const file of files) {
    console.log('[/media] uploading:', file.originalname, file.mimetype, file.size, 'bytes');
    try {
      const url = await uploadMedia(file);
      console.log('[/media] uploaded ok:', url);
      urls.push(url);
    } catch (err: any) {
      console.error('[/media] cloudinary error:', err?.message, err?.http_code ?? err?.statusCode);
      // Surface the real error message instead of generic 500
      throw new HttpError(err?.statusCode ?? err?.status ?? 502, `Cloudinary upload failed: ${err?.message ?? 'unknown error'}`);
    }
  }

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
