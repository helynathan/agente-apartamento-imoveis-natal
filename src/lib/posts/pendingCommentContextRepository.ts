import { db } from '@/lib/db';

const CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function recordPendingCommentContext(params: { commenterId: string; mediaId: string }): Promise<void> {
  await db.pendingCommentContext.upsert({
    where: { commenterId: params.commenterId },
    update: { mediaId: params.mediaId, createdAt: new Date() },
    create: { commenterId: params.commenterId, mediaId: params.mediaId },
  });
}

export async function findRecentMediaIdForCommenter(commenterId: string): Promise<string | null> {
  const context = await db.pendingCommentContext.findUnique({ where: { commenterId } });
  if (!context) return null;
  if (Date.now() - context.createdAt.getTime() > CONTEXT_TTL_MS) return null;
  return context.mediaId;
}
