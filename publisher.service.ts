import axios from 'axios';
import { SocialProvider, type ScheduledPost } from '@prisma/client';
import { env } from '../config/env';
import HttpError from '../utils/httpError';

type PublishResult = { provider: SocialProvider; id: string; url?: string };

async function publishToX(post: ScheduledPost): Promise<PublishResult> {
  if (!env.X_BEARER_TOKEN) {
    throw new HttpError(503, 'X publishing is not configured');
  }

  const response = await axios.post(
    'https://api.x.com/2/tweets',
    { text: post.text },
    { headers: { Authorization: `Bearer ${env.X_BEARER_TOKEN}` }, timeout: 15000 }
  );

  return { provider: SocialProvider.X, id: response.data?.data?.id ?? 'unknown' };
}

async function publishToLinkedIn(post: ScheduledPost): Promise<PublishResult> {
  if (!env.LINKEDIN_ACCESS_TOKEN || !env.LINKEDIN_AUTHOR_URN) {
    throw new HttpError(503, 'LinkedIn publishing is not configured');
  }

  const response = await axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: env.LINKEDIN_AUTHOR_URN,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.text },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    },
    {
      headers: {
        Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
        'X-Restli-Protocol-Version': '2.0.0'
      },
      timeout: 15000
    }
  );

  return { provider: SocialProvider.LINKEDIN, id: response.headers['x-restli-id'] ?? response.data?.id ?? 'unknown' };
}

async function publishToFacebook(post: ScheduledPost): Promise<PublishResult> {
  if (!env.FACEBOOK_PAGE_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) {
    throw new HttpError(503, 'Facebook publishing is not configured');
  }

  const endpoint = `https://graph.facebook.com/v21.0/${env.FACEBOOK_PAGE_ID}/feed`;
  const response = await axios.post(endpoint, null, {
    params: { message: post.text, access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN },
    timeout: 15000
  });

  return { provider: SocialProvider.FACEBOOK, id: response.data?.id ?? 'unknown' };
}

export async function publish(post: ScheduledPost): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  for (const provider of post.providers) {
    if (provider === SocialProvider.X) results.push(await publishToX(post));
    if (provider === SocialProvider.LINKEDIN) results.push(await publishToLinkedIn(post));
    if (provider === SocialProvider.FACEBOOK) results.push(await publishToFacebook(post));
    if (provider === SocialProvider.INSTAGRAM) {
      throw new HttpError(501, 'Instagram publishing requires media-container flow; configure before enabling');
    }
  }

  return results;
}
