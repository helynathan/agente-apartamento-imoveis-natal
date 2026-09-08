import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { getKanbanColumns } from '@/lib/conversations/kanbanBoard';

describe('getKanbanColumns', () => {
  afterEach(async () => {
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.conversation.deleteMany();
    await db.sector.deleteMany();
    await db.user.deleteMany();
  });

  it('places each conversation in the column matching its status', async () => {
    await db.conversation.create({
      data: { customerExternalId: '111', status: 'AI_HANDLING', lastInboundAt: new Date(Date.now() - 60_000) },
    });
    await db.conversation.create({
      data: { customerExternalId: '112', status: 'AI_HANDLING', lastInboundAt: new Date() },
    });
    await db.conversation.create({ data: { customerExternalId: '222', status: 'QUEUED' } });
    await db.conversation.create({ data: { customerExternalId: '333', status: 'ASSIGNED' } });
    await db.conversation.create({ data: { customerExternalId: '444', status: 'CLOSED' } });

    const columns = await getKanbanColumns();

    expect(columns.aiHandling.map((c) => c.customerExternalId)).toEqual(['112', '111']);
    expect(columns.queued.map((c) => c.customerExternalId)).toEqual(['222']);
    expect(columns.assigned.map((c) => c.customerExternalId)).toEqual(['333']);
    expect(columns.closed.map((c) => c.customerExternalId)).toEqual(['444']);
  });

  it('excludes CLOSED conversations older than 24 hours', async () => {
    const old = await db.conversation.create({ data: { customerExternalId: '555', status: 'CLOSED' } });
    await db.conversation.update({
      where: { id: old.id },
      data: { updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const columns = await getKanbanColumns();

    expect(columns.closed).toHaveLength(0);
  });

  it('includes sector name, assigned user name and the latest message preview', async () => {
    const sector = await db.sector.create({ data: { name: 'Locação' } });
    const user = await db.user.create({ data: { email: 'a@example.com', passwordHash: 'x', name: 'Ana' } });
    const conversation = await db.conversation.create({
      data: {
        customerExternalId: '666',
        customerName: 'Ana Cliente',
        status: 'ASSIGNED',
        sectorId: sector.id,
        assignedUserId: user.id,
      },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', content: 'Primeira' },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'OUTBOUND', content: 'Última mensagem' },
    });

    const columns = await getKanbanColumns();

    expect(columns.assigned).toEqual([
      expect.objectContaining({
        customerExternalId: '666',
        customerName: 'Ana Cliente',
        sectorName: 'Locação',
        assignedUserName: 'Ana',
        lastMessagePreview: 'Última mensagem',
      }),
    ]);
  });

  it('reflects the true AI_HANDLING count beyond the 7-day/50-row cap', async () => {
    await db.conversation.create({
      data: {
        customerExternalId: '777',
        status: 'AI_HANDLING',
        lastInboundAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
    });
    await db.conversation.create({
      data: { customerExternalId: '888', status: 'AI_HANDLING', lastInboundAt: new Date() },
    });

    const columns = await getKanbanColumns();

    expect(columns.aiHandling).toHaveLength(1);
    expect(columns.aiHandlingTotalCount).toBe(2);
  });

  it('includes the channel on each conversation', async () => {
    await db.conversation.create({ data: { channel: 'INSTAGRAM', customerExternalId: 'ig-1', status: 'QUEUED' } });

    const columns = await getKanbanColumns();

    expect(columns.queued).toEqual([expect.objectContaining({ channel: 'INSTAGRAM' })]);
  });

  it('includes the profile picture url on each conversation, or null when absent', async () => {
    await db.conversation.create({
      data: { customerExternalId: '777', status: 'QUEUED', profilePictureUrl: 'https://example.com/foto.jpg' },
    });
    await db.conversation.create({ data: { customerExternalId: '778', status: 'ASSIGNED' } });

    const columns = await getKanbanColumns();

    expect(columns.queued).toEqual([
      expect.objectContaining({ profilePictureUrl: 'https://example.com/foto.jpg' }),
    ]);
    expect(columns.assigned).toEqual([expect.objectContaining({ profilePictureUrl: null })]);
  });
});
