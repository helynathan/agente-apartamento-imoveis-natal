import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { claimConversation } from '@/lib/conversations/claimConversation';

describe('claimConversation', () => {
  afterEach(async () => {
    await db.conversation.deleteMany();
    await db.user.deleteMany();
    await db.sector.deleteMany();
  });

  async function setup() {
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    const sector = await db.sector.create({ data: { name: 'Financeiro' } });
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED' },
    });
    return { user, sector, conversation };
  }

  it('claims a QUEUED conversation, setting status, assignee and sector', async () => {
    const { user, sector, conversation } = await setup();

    const result = await claimConversation({
      conversationId: conversation.id,
      userId: user.id,
      sectorId: sector.id,
    });

    expect(result).toEqual({ claimed: true });

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('ASSIGNED');
    expect(updated?.assignedUserId).toBe(user.id);
    expect(updated?.sectorId).toBe(sector.id);
  });

  it('claims an AI_HANDLING conversation, letting a human take over from the AI', async () => {
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    const sector = await db.sector.create({ data: { name: 'Financeiro' } });
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'AI_HANDLING' },
    });

    const result = await claimConversation({
      conversationId: conversation.id,
      userId: user.id,
      sectorId: sector.id,
    });

    expect(result).toEqual({ claimed: true });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('ASSIGNED');
    expect(updated?.assignedUserId).toBe(user.id);
  });

  it('fails to claim a conversation that is no longer QUEUED', async () => {
    const { user, sector, conversation } = await setup();
    await claimConversation({ conversationId: conversation.id, userId: user.id, sectorId: sector.id });

    const secondUser = await db.user.create({
      data: { email: 'b@example.com', passwordHash: 'x', name: 'B' },
    });
    const result = await claimConversation({
      conversationId: conversation.id,
      userId: secondUser.id,
      sectorId: sector.id,
    });

    expect(result).toEqual({ claimed: false });

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.assignedUserId).toBe(user.id);
  });
});
