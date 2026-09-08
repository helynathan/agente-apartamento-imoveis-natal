import { db } from '@/lib/db';
import type { ConversationStatus, Channel } from '@prisma/client';
import { interpretReopenReply } from '@/lib/conversations/interpretReopenReply';

const STALE_QUEUE_MS = 24 * 60 * 60 * 1000;

export async function persistInboundMessage(params: {
  channel: Channel;
  phone: string;
  text: string;
  externalId: string;
  name?: string;
  profilePictureUrl?: string;
}): Promise<{
  conversationId: string;
  messageId: string;
  status: ConversationStatus;
  needsReopenPrompt?: boolean;
  isNewConversation: boolean;
}> {
  const identity = { channel_customerExternalId: { channel: params.channel, customerExternalId: params.phone } };

  const existing = await db.conversation.findUnique({ where: identity });
  const previousStatus = existing?.status ?? null;
  const previousLastInboundAt = existing?.lastInboundAt ?? null;
  const previousReopenPromptSentAt = existing?.reopenPromptSentAt ?? null;
  const previousAssignedUserId = existing?.assignedUserId ?? null;
  const isNewConversation = !existing;

  const conversation = await db.conversation.upsert({
    where: identity,
    update: { lastInboundAt: new Date(), slaEscalatedAt: null, ...(params.name ? { customerName: params.name } : {}) },
    create: {
      channel: params.channel,
      customerExternalId: params.phone,
      lastInboundAt: new Date(),
      customerName: params.name,
      profilePictureUrl: params.profilePictureUrl,
    },
  });

  let status: ConversationStatus = conversation.status;
  let needsReopenPrompt = false;

  if (previousStatus === 'QUEUED' && previousReopenPromptSentAt) {
    const wantsNewTopic = interpretReopenReply(params.text) === 'novo_assunto';

    if (wantsNewTopic) {
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          status: 'AI_HANDLING',
          sectorId: null,
          assignedUserId: null,
          aiMessageCount: 1,
          reopenPromptSentAt: null,
        },
      });
      status = 'AI_HANDLING';
    } else {
      await db.conversation.update({
        where: { id: conversation.id },
        data: { reopenPromptSentAt: null },
      });
      status = 'QUEUED';
    }
  } else if (
    previousStatus === 'QUEUED' &&
    !previousReopenPromptSentAt &&
    previousLastInboundAt &&
    Date.now() - previousLastInboundAt.getTime() > STALE_QUEUE_MS
  ) {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { reopenPromptSentAt: new Date() },
    });
    status = 'QUEUED';
    needsReopenPrompt = true;
  } else if (previousStatus === 'CLOSED' && previousAssignedUserId) {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: 'ASSIGNED' },
    });
    status = 'ASSIGNED';
  } else {
    const reopened = await db.conversation.updateMany({
      where: { id: conversation.id, status: 'CLOSED' },
      data: { status: 'AI_HANDLING', sectorId: null, assignedUserId: null, aiMessageCount: 0 },
    });

    if (reopened.count > 0) {
      status = 'AI_HANDLING';
    }

    if (status === 'AI_HANDLING') {
      await db.conversation.updateMany({
        where: { id: conversation.id, status: 'AI_HANDLING' },
        data: { aiMessageCount: { increment: 1 } },
      });
    }
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      content: params.text,
      externalId: params.externalId,
    },
  });

  return { conversationId: conversation.id, messageId: message.id, status, needsReopenPrompt, isNewConversation };
}
