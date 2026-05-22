import { ScheduledPostStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { publish } from './publisher.service';

const BATCH_SIZE = 10;

export async function processPosts(now = new Date()) {
  const duePosts = await prisma.scheduledPost.findMany({
    where: {
      status: ScheduledPostStatus.SCHEDULED,
      scheduledAt: { lte: now },
      attemptCount: { lt: 3 }
    },
    orderBy: { scheduledAt: 'asc' },
    take: BATCH_SIZE
  });

  const summary = { scanned: duePosts.length, published: 0, failed: 0, skipped: 0, results: [] as unknown[] };

  for (const post of duePosts) {
    const locked = await prisma.scheduledPost.updateMany({
      where: { id: post.id, status: ScheduledPostStatus.SCHEDULED },
      data: { status: ScheduledPostStatus.PUBLISHING, attemptCount: { increment: 1 }, lastError: null }
    });

    if (locked.count !== 1) {
      summary.skipped += 1;
      continue;
    }

    try {
      const providerResults = await publish(post);
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: ScheduledPostStatus.PUBLISHED,
          publishedAt: new Date(),
          providerPostIds: providerResults
        }
      });
      summary.published += 1;
      summary.results.push({ id: post.id, status: 'PUBLISHED', providerResults });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown publish error';
      const nextStatus = post.attemptCount + 1 >= post.maxAttempts ? ScheduledPostStatus.FAILED : ScheduledPostStatus.SCHEDULED;
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: nextStatus,
          failedAt: nextStatus === ScheduledPostStatus.FAILED ? new Date() : null,
          lastError: message
        }
      });
      summary.failed += 1;
      summary.results.push({ id: post.id, status: nextStatus, error: message });
    }
  }

  return summary;
}
