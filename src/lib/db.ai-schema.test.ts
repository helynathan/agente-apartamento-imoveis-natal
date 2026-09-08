import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';

describe('AI handling schema', () => {
  afterEach(async () => {
    await db.conversation.deleteMany();
  });

  it('defaults a new conversation to AI_HANDLING with aiMessageCount 0', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });

    expect(conversation.status).toBe('AI_HANDLING');
    expect(conversation.aiMessageCount).toBe(0);
  });

  it('allows setting aiMessageCount explicitly', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511988888888', aiMessageCount: 3 },
    });

    expect(conversation.aiMessageCount).toBe(3);
  });
});
