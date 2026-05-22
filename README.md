# FlowFit Social Server

Production-ready Express + Prisma API for scheduling FlowFit marketing posts and publishing due posts through a protected endpoint that can be called by an external cron service.

## Stack

- Vercel Serverless Function entrypoint: `api/index.ts`
- Express API under `/api/*`
- PostgreSQL through Prisma
- Cloudinary media uploads
- Protected external cron endpoint
- JWT bearer auth for user-facing routes

## Required environment variables

Copy `.env.example` into your Vercel project environment variables.

Required:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
JWT_SECRET=replace_with_64_plus_random_chars
CRON_SECRET=replace_with_64_plus_random_chars
APP_ORIGIN=https://flowfit.cctamcc.site,https://your-frontend.vercel.app
NODE_ENV=production
```

Cloudinary is required only for `/api/social/media` uploads:

```bash
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=flowfit/social
```

Provider tokens are optional until your live provider apps are ready:

```bash
X_BEARER_TOKEN=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_AUTHOR_URN=
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_PAGE_ID=
```

## Local setup

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Health checks:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/db
```

## Deploy to Vercel

1. Create a Vercel project from this repository.
2. Add all required environment variables in Vercel.
3. Set Node.js version to 20 or newer.
4. Deploy.
5. Run the Prisma migration against production once:

```bash
npx prisma migrate deploy
```

Vercel uses `api/index.ts` as the serverless entrypoint. `vercel.json` rewrites all requests to that function.

## External cron setup

Use an external scheduler such as cron-job.org, EasyCron, GitHub Actions schedule, Better Stack, or UptimeRobot.

Cron request:

```bash
POST https://YOUR-VERCEL-DOMAIN/api/social/cron/publish-due
Authorization: Bearer YOUR_CRON_SECRET
```

Alternative header:

```bash
x-cron-secret: YOUR_CRON_SECRET
```

Recommended interval: every 1 to 5 minutes. The endpoint processes a small batch of due scheduled posts and is protected by constant-time secret comparison.

## Main endpoints

### Health

```http
GET /api/health
GET /api/health/db
```

### Providers

```http
GET /api/social/providers
Authorization: Bearer USER_JWT
```

### Upload media

```http
POST /api/social/media
Authorization: Bearer USER_JWT
Content-Type: multipart/form-data
```

Field name: `media`. Maximum 4 files, 10MB each.

### Schedule a post

```http
POST /api/social/posts
Authorization: Bearer USER_JWT
Content-Type: application/json

{
  "text": "Train smarter at home with FlowFit.",
  "providers": ["LINKEDIN", "FACEBOOK"],
  "scheduledAt": "2026-05-22T18:00:00.000Z",
  "mediaUrls": []
}
```

### List posts

```http
GET /api/social/posts
GET /api/social/posts?status=SCHEDULED
Authorization: Bearer USER_JWT
```

### Cancel a post

```http
PATCH /api/social/posts/:id/cancel
Authorization: Bearer USER_JWT
```

## Notes for provider publishing

- LinkedIn text publishing is wired through the UGC Posts API.
- Facebook page text publishing is wired through Graph API page feed publishing.
- X posting is wired through the v2 tweet endpoint and requires a token with write permission.
- Instagram publishing usually requires a media-container workflow and is intentionally blocked until configured explicitly.

## Production hardening included

- Strict environment validation at boot.
- CORS allowlist through `APP_ORIGIN`.
- `trust proxy` enabled for Vercel.
- Helmet security headers.
- API rate limiting.
- JWT bearer authentication for user routes.
- Protected cron endpoint with timing-safe secret comparison.
- Prisma singleton pattern for serverless reuse.
- Publish locking through status transition from `SCHEDULED` to `PUBLISHING`.
- Retry/fail handling with `attemptCount`, `maxAttempts`, `lastError`, and terminal `FAILED` status.
