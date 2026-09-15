import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { findOverdueConversations } from './findOverdueConversations';

describe('findOverdueConversations', () => {
  afterEach(async () => {
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.conversation.deleteMany();
  });

  it('includes a QUEUED conversation with no reply, overdue past the threshold', async () => {
    // Monday 2026-09-07, 10:00 local (UTC 13:00) -> now = 10:20 local (UTC 13:20): 20 business minutes elapsed
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 20, 0));
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', customerName: 'Cliente', status: 'QUEUED', lastInboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue.map((c) => c.id)).toContain(conversation.id);
  });

  it('excludes a conversation not yet past the threshold', async () => {
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 10, 0)); // only 10 business minutes elapsed
    await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED', lastInboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue).toHaveLength(0);
  });

  it('excludes an AI_HANDLING conversation whose last outbound reply is newer than the last inbound message', async () => {
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const lastOutboundAt = new Date(Date.UTC(2026, 8, 7, 13, 5, 0)); // AI already replied after the inbound message
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'AI_HANDLING', lastInboundAt, lastOutboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue).toHaveLength(0);
  });

  it('includes a QUEUED conversation even when the last outbound was the AI handoff message', async () => {
    // Mirrors a real incident: the AI's last message ("encaminhando pro setor comercial") lands
    // after the customer's last message, but the customer is still waiting for a human in the queue.
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const lastOutboundAt = new Date(Date.UTC(2026, 8, 7, 13, 5, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED', lastInboundAt, lastOutboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue.map((c) => c.id)).toContain(conversation.id);
  });

  it('excludes a CLOSED conversation even if it looks overdue', async () => {
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'CLOSED', lastInboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue).toHaveLength(0);
  });

  it('excludes a conversation already marked as escalated', async () => {
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        status: 'QUEUED',
        lastInboundAt,
        slaEscalatedAt: new Date(Date.UTC(2026, 8, 7, 13, 16, 0)),
      },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue).toHaveLength(0);
  });

  it('excludes a conversation with no lastInboundAt yet', async () => {
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED' },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue).toHaveLength(0);
  });

  it('includes a conversation overdue on a Sunday (SLA counts real elapsed time, not just business hours)', async () => {
    // Sunday 2026-09-13, 10:00 UTC -> now = 10:20 UTC: 20 minutes elapsed on the wall clock
    const lastInboundAt = new Date(Date.UTC(2026, 8, 13, 10, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 13, 10, 20, 0));
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', customerName: 'Cliente de domingo', status: 'QUEUED', lastInboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue.map((c) => c.id)).toContain(conversation.id);
  });

  it('includes an AI_HANDLING conversation past the threshold (status just needs to not be CLOSED)', async () => {
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'AI_HANDLING', lastInboundAt },
    });

    const overdue = await findOverdueConversations(now, 15);

    expect(overdue.map((c) => c.id)).toContain(conversation.id);
  });
});
