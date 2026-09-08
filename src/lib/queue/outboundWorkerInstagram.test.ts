import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/instagram/sendInstagramMessage', () => ({
  sendInstagramMessage: vi.fn(),
}));
vi.mock('@/lib/realtime/broadcast', () => ({
  broadcastEvent: vi.fn(),
}));

import { sendInstagramMessage } from '@/lib/instagram/sendInstagramMessage';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { processNextInstagramOutboundMessage } from '@/lib/queue/outboundWorkerInstagram';

describe('processNextInstagramOutboundMessage', () => {
  afterEach(async () => {
    vi.resetAllMocks();
    await db.outboundMessage.deleteMany();
    await db.message.deleteMany();
    await db.conversation.deleteMany();
  });

  it('returns processed: false when there is nothing pending', async () => {
    const result = await processNextInstagramOutboundMessage();
    expect(result).toEqual({ processed: false });
  });

  it('does not process a PENDING message belonging to a WHATSAPP conversation', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'WHATSAPP', customerExternalId: '5511999999999' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });

    const result = await processNextInstagramOutboundMessage();

    expect(result).toEqual({ processed: false });
    expect(sendInstagramMessage).not.toHaveBeenCalled();
  });

  it('sends the oldest pending Instagram message and marks it as SENT', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendInstagramMessage).mockResolvedValue({ id: 'IGM999' });

    const result = await processNextInstagramOutboundMessage();

    expect(result).toEqual({ processed: true });
    expect(sendInstagramMessage).toHaveBeenCalledWith({ externalId: 'ig-user-1', text: 'Olá' });

    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('SENT');
    expect(updated?.sentAt).not.toBeNull();

    const messages = await db.message.findMany({ where: { conversationId: conversation.id } });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ direction: 'OUTBOUND', content: 'Olá', externalId: 'IGM999' });
  });

  it('re-queues as PENDING and records the error when sendInstagramMessage throws on the 1st attempt', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendInstagramMessage).mockRejectedValue(new Error('N8N Instagram send webhook responded with HTTP 500'));

    const result = await processNextInstagramOutboundMessage();

    expect(result).toEqual({ processed: true });
    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('PENDING');
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('N8N Instagram send webhook responded with HTTP 500');
  });

  it('marks the message as FAILED once attempts reaches 3', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1' },
    });
    const outbound = await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING', attempts: 2 },
    });
    vi.mocked(sendInstagramMessage).mockRejectedValue(new Error('boom'));

    await processNextInstagramOutboundMessage();

    const updated = await db.outboundMessage.findUnique({ where: { id: outbound.id } });
    expect(updated?.status).toBe('FAILED');
    expect(updated?.attempts).toBe(3);
  });

  it('sets lastOutboundAt on the conversation on successful send', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendInstagramMessage).mockResolvedValue({ id: 'IG123' });
    const before = new Date();

    await processNextInstagramOutboundMessage();

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.lastOutboundAt).not.toBeNull();
    expect(updated!.lastOutboundAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('broadcasts message:new after a successful send', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1' },
    });
    await db.outboundMessage.create({
      data: { conversationId: conversation.id, content: 'Olá', status: 'PENDING' },
    });
    vi.mocked(sendInstagramMessage).mockResolvedValue({ id: 'IGM999' });

    await processNextInstagramOutboundMessage();

    expect(broadcastEvent).toHaveBeenCalledWith({ type: 'message:new', conversationId: conversation.id });
  });
});
