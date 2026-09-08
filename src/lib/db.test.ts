import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';

describe('db', () => {
  afterEach(async () => {
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.conversation.deleteMany();
  });

  it('creates a conversation with a message', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });

    const message = await db.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: 'Olá',
      },
    });

    expect(message.conversationId).toBe(conversation.id);
  });
});
