import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/evolutionApi', () => ({
  sendText: vi.fn(),
}));

vi.mock('@/lib/realtime/broadcast', () => ({
  broadcastEvent: vi.fn(),
}));

import { sendText } from '@/lib/evolutionApi';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { processNextOutboundMessage } from '@/lib/queue/outboundWorker';

describe('processNextOutboundMessage', () => {
  afterEach(async () => {
    vi.resetAllMocks();
    await db.outboundMessage.deleteMany();
    await db.message.deleteMany();
    await db.conversation.deleteMany();
  });

  it('returns processed: false when there is nothing pending', async () => {
    const result = await processNextOutboundMessage();
    expect(result).toEqual({ processed: false });
  });

  it('sends the oldest pending message and marks it as SENT', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO123' });

    const result = await processNextOutboundMessage();

    expect(result).toEqual({ processed: true });
    expect(sendText).toHaveBeenCalledWith({ phone: '5511999999999', text: 'Olá' });

    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('SENT');
    expect(updated?.sentAt).not.toBeNull();
  });

  it('records an OUTBOUND message in the conversation history on successful send', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO123' });

    await processNextOutboundMessage();

    const messages = await db.message.findMany({ where: { conversationId: conversation.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: 'OUTBOUND',
      content: 'Olá',
      externalId: 'EVO123',
    });
  });

  it('sets lastOutboundAt on the conversation on successful send', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO123' });
    const before = new Date();

    await processNextOutboundMessage();

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.lastOutboundAt).not.toBeNull();
    expect(updated!.lastOutboundAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('does not record a Message when sendText fails', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendText).mockRejectedValue(new Error('Evolution API error (500): boom'));

    await processNextOutboundMessage();

    const messages = await db.message.findMany({ where: { conversationId: conversation.id } });
    expect(messages).toHaveLength(0);
  });

  it('re-queues as PENDING and records the error when sendText throws on the 1st attempt', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendText).mockRejectedValue(new Error('Evolution API error (500): boom'));

    const result = await processNextOutboundMessage();

    expect(result).toEqual({ processed: true });

    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('PENDING');
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('Evolution API error (500): boom');
  });

  it('marks the message as FAILED once attempts reaches 3', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING', attempts: 2 },
    });
    vi.mocked(sendText).mockRejectedValue(new Error('Evolution API error (500): boom'));

    const result = await processNextOutboundMessage();

    expect(result).toEqual({ processed: true });

    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('FAILED');
    expect(updated?.attempts).toBe(3);
    expect(updated?.lastError).toBe('Evolution API error (500): boom');
  });

  it('keeps the message SENT even when broadcastEvent rejects after a successful send', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO123' });
    vi.mocked(broadcastEvent).mockRejectedValue(new Error('broadcast down'));

    await expect(processNextOutboundMessage()).rejects.toThrow('broadcast down');
    expect(broadcastEvent).toHaveBeenCalledWith({ type: 'message:new', conversationId: conversation.id });

    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('SENT');
    expect(updated?.attempts).toBe(0);
    expect(updated?.lastError).toBeNull();
  });

  it('processes only the oldest pending message, leaving the newer one PENDING', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999' },
    });
    const older = await db.outboundMessage.create({
      data: {
        conversationId: conversation.id,
        content: 'Mais antiga',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 60_000),
      },
    });
    const newer = await db.outboundMessage.create({
      data: {
        conversationId: conversation.id,
        content: 'Mais nova',
        status: 'PENDING',
        createdAt: new Date(),
      },
    });
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO123' });

    await processNextOutboundMessage();

    const processedOlder = await db.outboundMessage.findUnique({ where: { id: older.id } });
    const processedNewer = await db.outboundMessage.findUnique({ where: { id: newer.id } });
    expect(processedOlder?.status).toBe('SENT');
    expect(processedNewer?.status).toBe('PENDING');
  });

  it('does not process a PENDING message belonging to an INSTAGRAM conversation', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });

    const result = await processNextOutboundMessage();

    expect(result).toEqual({ processed: false });
    expect(sendText).not.toHaveBeenCalled();
  });
});
