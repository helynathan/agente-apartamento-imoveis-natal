import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { closeInactiveConversations } from '@/lib/conversations/closeInactiveConversations';

describe('closeInactiveConversations', () => {
  afterEach(async () => {
    await db.conversation.deleteMany();
    await db.user.deleteMany();
  });

  it('closes an ASSIGNED conversation inactive for more than 24h', async () => {
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    const now = new Date('2026-08-20T12:00:00Z');
    const conversation = await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        status: 'ASSIGNED',
        assignedUserId: user.id,
        lastInboundAt: new Date('2026-08-19T11:00:00Z'),
      },
    });

    const result = await closeInactiveConversations(now);

    expect(result).toEqual({ closed: 1, conversationIds: [conversation.id] });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('CLOSED');
  });

  it('does not close a conversation inactive for less than 24h', async () => {
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    const now = new Date('2026-08-20T12:00:00Z');
    await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        status: 'ASSIGNED',
        assignedUserId: user.id,
        lastInboundAt: new Date('2026-08-20T00:00:00Z'),
      },
    });

    const result = await closeInactiveConversations(now);

    expect(result).toEqual({ closed: 0, conversationIds: [] });
  });

  it('does not touch QUEUED or already CLOSED conversations', async () => {
    const now = new Date('2026-08-20T12:00:00Z');
    await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        status: 'QUEUED',
        lastInboundAt: new Date('2026-08-01T00:00:00Z'),
      },
    });

    const result = await closeInactiveConversations(now);

    expect(result).toEqual({ closed: 0, conversationIds: [] });
  });
});
