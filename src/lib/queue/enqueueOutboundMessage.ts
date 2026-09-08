import { db } from '@/lib/db';

export async function enqueueOutboundMessage(params: {
  conversationId: string;
  content: string;
}): Promise<{ id: string }> {
  const outboundMessage = await db.outboundMessage.create({
    data: {
      conversationId: params.conversationId,
      content: params.content,
      status: 'PENDING',
    },
  });

  return { id: outboundMessage.id };
}
