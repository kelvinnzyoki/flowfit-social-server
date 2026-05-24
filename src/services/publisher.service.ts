import axios from 'axios';
import { SocialProvider, type ScheduledPost } from '@prisma/client';
import { env } from '../config/env';
import HttpError from '../utils/httpError';

type PublishResult = { provider: SocialProvider; id: string; url?: string };

const GRAPH_VERSION = 'v21.0';

function firstMediaUrl(post: ScheduledPost) {
  const urls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  return typeof urls[0] === 'string' ? urls[0] : undefined;
}

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

  return {
    provider: SocialProvider.LINKEDIN,
    id: response.headers['x-restli-id'] ?? response.data?.id ?? 'unknown'
  };
}

async function publishToFacebook(post: ScheduledPost): Promise<PublishResult> {
  if (!env.FACEBOOK_PAGE_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) {
    throw new HttpError(503, 'Facebook publishing is not configured');
  }

  const mediaUrl = firstMediaUrl(post);

  if (mediaUrl) {
    const photoEndpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${env.FACEBOOK_PAGE_ID}/photos`;
    const response = await axios.post(photoEndpoint, null, {
      params: {
        url: mediaUrl,
        caption: post.text,
        access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN
      },
      timeout: 20000
    });

    return { provider: SocialProvider.FACEBOOK, id: response.data?.post_id ?? response.data?.id ?? 'unknown' };
  }

  const feedEndpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${env.FACEBOOK_PAGE_ID}/feed`;
  const response = await axios.post(feedEndpoint, null, {
    params: { message: post.text, access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN },
    timeout: 15000
  });

  return { provider: SocialProvider.FACEBOOK, id: response.data?.id ?? 'unknown' };
}

async function publishToInstagram(post: ScheduledPost): Promise<PublishResult> {
  if (!env.FACEBOOK_PAGE_ACCESS_TOKEN || !env.INSTAGRAM_ACCOUNT_ID) {
    throw new HttpError(503, 'Instagram publishing is not configured');
  }

  const mediaUrl = firstMediaUrl(post);
  if (!mediaUrl) {
    throw new HttpError(400, 'Instagram publishing requires at least one image or video URL');
  }

  const isVideo = /\.(mp4|mov|m4v)(\?|#|$)/i.test(mediaUrl);
  const createEndpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${env.INSTAGRAM_ACCOUNT_ID}/media`;

  const createResponse = await axios.post(createEndpoint, null, {
    params: {
      caption: post.text,
      access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN,
      ...(isVideo ? { media_type: 'REELS', video_url: mediaUrl } : { image_url: mediaUrl })
    },
    timeout: 30000
  });

  const creationId = createResponse.data?.id;
  if (!creationId) {
    throw new HttpError(502, 'Instagram did not return a media container id');
  }

  const publishEndpoint = `https://graph.facebook.com/${GRAPH_VERSION}/${env.INSTAGRAM_ACCOUNT_ID}/media_publish`;
  const publishResponse = await axios.post(publishEndpoint, null, {
    params: {
      creation_id: creationId,
      access_token: env.FACEBOOK_PAGE_ACCESS_TOKEN
    },
    timeout: 30000
  });

  return { provider: SocialProvider.INSTAGRAM, id: publishResponse.data?.id ?? creationId };
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
