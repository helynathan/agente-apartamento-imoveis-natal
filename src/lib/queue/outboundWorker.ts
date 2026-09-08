import { db } from '@/lib/db';
import { sendText } from '@/lib/evolutionApi';
import { broadcastEvent } from '@/lib/realtime/broadcast';

export async function processNextOutboundMessage(): Promise<{ processed: boolean }> {
  const next = await db.outboundMessage.findFirst({
    where: { status: 'PENDING', conversation: { channel: 'WHATSAPP' } },
    orderBy: { createdAt: 'asc' },
    include: { conversation: true },
  });

  if (!next) {
    return { processed: false };
  }

  let sentOk = false;
  try {
    const sent = await sendText({ phone: next.conversation.customerExternalId, text: next.content });
    await db.$transaction([
      db.outboundMessage.update({
        where: { id: next.id },
        data: { status: 'SENT', sentAt: new Date() },
      }),
      db.message.create({
        data: {
          conversationId: next.conversationId,
          direction: 'OUTBOUND',
          content: next.content,
          externalId: sent.id,
        },
      }),
      db.conversation.update({
        where: { id: next.conversationId },
        data: { lastOutboundAt: new Date() },
      }),
    ]);
    sentOk = true;
  } catch (error) {
    const newAttempts = next.attempts + 1;
    await db.outboundMessage.update({
      where: { id: next.id },
      data: {
        status: newAttempts >= 3 ? 'FAILED' : 'PENDING',
        attempts: newAttempts,
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }

  if (sentOk) {
    await broadcastEvent({ type: 'message:new', conversationId: next.conversationId });
  }

  return { processed: true };
}
