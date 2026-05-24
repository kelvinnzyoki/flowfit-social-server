import { SocialProvider } from '@prisma/client';
import { env } from '../config/env';

export function getProviderConnectionStatus() {
  return {
    [SocialProvider.X]: Boolean(env.X_BEARER_TOKEN || (env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET)),
    [SocialProvider.LINKEDIN]: Boolean(env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_AUTHOR_URN),
    [SocialProvider.FACEBOOK]: Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID),
    [SocialProvider.INSTAGRAM]: Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID)
  };
}

export function connect(provider: SocialProvider) {
  return {
    provider,
    configured: getProviderConnectionStatus()[provider],
    message: 'This single-owner build publishes with provider tokens stored in Vercel environment variables. For multi-user SaaS, store connected account tokens per user in Prisma.'
  };
}
