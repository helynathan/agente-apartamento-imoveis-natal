import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';

describe('panel schema', () => {
  afterEach(async () => {
    await db.conversation.deleteMany();
    await db.user.deleteMany();
    await db.sector.deleteMany();
  });

  it('creates a user and a sector, and assigns them to a conversation', async () => {
    const user = await db.user.create({
      data: { email: 'agente@example.com', passwordHash: 'hash', name: 'Agente' },
    });
    const sector = await db.sector.create({ data: { name: 'Financeiro' } });
    const conversation = await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        sectorId: sector.id,
        assignedUserId: user.id,
        status: 'ASSIGNED',
      },
    });

    expect(conversation.status).toBe('ASSIGNED');
    expect(conversation.sectorId).toBe(sector.id);
    expect(conversation.assignedUserId).toBe(user.id);
  });

  it('creates a QUEUED conversation with no sector or assignee', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511988888888', status: 'QUEUED' },
    });

    expect(conversation.status).toBe('QUEUED');
    expect(conversation.sectorId).toBeNull();
    expect(conversation.assignedUserId).toBeNull();
  });
});
