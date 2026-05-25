import { SocialProvider } from '@prisma/client';
import { env } from '../config/env';

export function getProviderConnectionStatus() {
  return {
    [SocialProvider.X]: Boolean(env.X_ACCESS_TOKEN || env.X_BEARER_TOKEN),
    [SocialProvider.LINKEDIN]: Boolean(env.LINKEDIN_ACCESS_TOKEN && env.LINKEDIN_AUTHOR_URN),
    [SocialProvider.FACEBOOK]: Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN && env.FACEBOOK_PAGE_ID),
    [SocialProvider.INSTAGRAM]: Boolean(env.FACEBOOK_PAGE_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID)
  };
}
