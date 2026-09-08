import { db } from '@/lib/db';

export async function claimConversation(params: {
  conversationId: string;
  userId: string;
  sectorId: string;
}): Promise<{ claimed: boolean }> {
  const result = await db.conversation.updateMany({
    where: { id: params.conversationId, status: { in: ['QUEUED', 'AI_HANDLING'] } },
    data: { status: 'ASSIGNED', assignedUserId: params.userId, sectorId: params.sectorId },
  });

  return { claimed: result.count === 1 };
}
