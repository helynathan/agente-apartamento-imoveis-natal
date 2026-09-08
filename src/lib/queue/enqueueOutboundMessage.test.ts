import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';

describe('enqueueOutboundMessage', () => {
  afterEach(async () => {
    await db.outboundMessage.deleteMany();
    await db.message.deleteMany();
    await db.conversation.deleteMany();
  });

  it('creates a pending outbound message linked to the conversation', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });

    const result = await enqueueOutboundMessage({
      conversationId: conversation.id,
      content: 'Olá, como posso ajudar?',
    });

    const stored = await db.outboundMessage.findUnique({ where: { id: result.id } });
    expect(stored?.status).toBe('PENDING');
    expect(stored?.content).toBe('Olá, como posso ajudar?');
    expect(stored?.conversationId).toBe(conversation.id);
  });
});
