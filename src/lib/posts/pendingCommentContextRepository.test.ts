import { describe, it, expect, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { recordPendingCommentContext, findRecentMediaIdForCommenter } from '@/lib/posts/pendingCommentContextRepository';

describe('pendingCommentContextRepository', () => {
  afterEach(async () => {
    vi.useRealTimers();
    await db.pendingCommentContext.deleteMany();
  });

  it('records a new pending context on first call', async () => {
    await recordPendingCommentContext({ commenterId: 'commenter-1', mediaId: 'media-1' });

    const mediaId = await findRecentMediaIdForCommenter('commenter-1');
    expect(mediaId).toBe('media-1');
  });

  it('overwrites the mediaId on a second call for the same commenter', async () => {
    await recordPendingCommentContext({ commenterId: 'commenter-1', mediaId: 'media-1' });
    await recordPendingCommentContext({ commenterId: 'commenter-1', mediaId: 'media-2' });

    const mediaId = await findRecentMediaIdForCommenter('commenter-1');
    expect(mediaId).toBe('media-2');
  });

  it('returns null when no context exists for the commenter', async () => {
    const mediaId = await findRecentMediaIdForCommenter('commenter-inexistente');
    expect(mediaId).toBeNull();
  });

  it('returns null when the stored context is older than 7 days', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await db.pendingCommentContext.create({
      data: { commenterId: 'commenter-1', mediaId: 'media-1', createdAt: eightDaysAgo },
    });

    const mediaId = await findRecentMediaIdForCommenter('commenter-1');
    expect(mediaId).toBeNull();
  });
});
