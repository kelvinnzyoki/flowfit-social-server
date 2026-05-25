import axios from 'axios';
import { SocialProvider, type ScheduledPost } from '@prisma/client';
import { env } from '../config/env';
import HttpError from '../utils/httpError';

type PublishResult = { provider: SocialProvider; id: string; url?: string };

function firstMedia(post: ScheduledPost) {
  return Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 ? post.mediaUrls[0] : undefined;
}

async function publishToX(post: ScheduledPost): Promise<PublishResult> {
  const token = env.X_ACCESS_TOKEN || env.X_BEARER_TOKEN;

  if (!token) {
    throw new HttpError(503, 'X publishing is not configured');
  }

  const response = await axios.post(
    'https://api.x.com/2/tweets',
    { text: post.text.slice(0, 280) },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
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
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
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

  const mediaUrl = firstMedia(post);

  if (mediaUrl) {
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${env.FACEBOOK_PAGE_ID}/photos`,
      null,
      {
        params: {
          url: mediaUrl,
          caption: post.text,
          access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN
        },
        timeout: 20000
      }
    );

    return { provider: SocialProvider.FACEBOOK, id: response.data?.post_id ?? response.data?.id ?? 'unknown' };
  }

  const response = await axios.post(
    `https://graph.facebook.com/v21.0/${env.FACEBOOK_PAGE_ID}/feed`,
    null,
    {
      params: {
        message: post.text,
        access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN
      },
      timeout: 15000
    }
  );

  return { provider: SocialProvider.FACEBOOK, id: response.data?.id ?? 'unknown' };
}

async function publishToInstagram(post: ScheduledPost): Promise<PublishResult> {
  if (!env.FACEBOOK_PAGE_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    throw new HttpError(503, 'Instagram publishing is not configured');
  }

  const imageUrl = firstMedia(post);
  if (!imageUrl) {
    throw new HttpError(400, 'Instagram publishing requires an uploaded image URL');
  }

  const container = await axios.post(
    `https://graph.facebook.com/v21.0/${env.INSTAGRAM_ACCOUNT_ID}/media`,
    null,
    {
      params: {
        image_url: imageUrl,
        caption: post.text,
        access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN
      },
      timeout: 20000
    }
  );

  const creationId = container.data?.id;
  if (!creationId) {
    throw new HttpError(502, 'Instagram did not return a media container id');
  }

  const publishResponse = await axios.post(
    `https://graph.facebook.com/v21.0/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`,
    null,
    {
      params: {
        creation_id: creationId,
        access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN
      },
      timeout: 20000
    }
  );

  return { provider: SocialProvider.INSTAGRAM, id: publishResponse.data?.id ?? 'unknown' };
}

export async function publish(post: ScheduledPost): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  for (const provider of post.providers) {
    if (provider === SocialProvider.X) results.push(await publishToX(post));
    if (provider === SocialProvider.LINKEDIN) results.push(await publishToLinkedIn(post));
    if (provider === SocialProvider.FACEBOOK) results.push(await publishToFacebook(post));
    if (provider === SocialProvider.INSTAGRAM) results.push(await publishToInstagram(post));
  }

  return results;
}
