import { db } from '@/lib/db';

const INACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function closeInactiveConversations(
  now: Date = new Date()
): Promise<{ closed: number; conversationIds: string[] }> {
  const threshold = new Date(now.getTime() - INACTIVITY_WINDOW_MS);

  const toClose = await db.conversation.findMany({
    where: { status: 'ASSIGNED', lastInboundAt: { lt: threshold } },
    select: { id: true },
  });

  if (toClose.length === 0) {
    return { closed: 0, conversationIds: [] };
  }

  const ids = toClose.map((c) => c.id);
  await db.conversation.updateMany({
    where: { id: { in: ids } },
    data: { status: 'CLOSED' },
  });

  return { closed: ids.length, conversationIds: ids };
}
