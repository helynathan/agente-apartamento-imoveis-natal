import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/evolutionApi', () => ({
  sendText: vi.fn(),
}));

import { sendText } from '@/lib/evolutionApi';
import { escalateOverdueConversations } from './escalateOverdueConversations';

describe('escalateOverdueConversations', () => {
  afterEach(async () => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.conversation.deleteMany();
    await db.user.deleteMany();
  });

  it('sends a WhatsApp message to every admin with a phone, for each overdue conversation, and marks it escalated', async () => {
    vi.stubEnv('SLA_MINUTES', '15');
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO1' });

    await db.user.create({
      data: { email: 'admin1@example.com', passwordHash: 'x', name: 'Admin 1', role: 'ADMIN', phone: '5511900000001' },
    });
    await db.user.create({
      data: { email: 'admin2@example.com', passwordHash: 'x', name: 'Admin 2', role: 'ADMIN', phone: '5511900000002' },
    });
    await db.user.create({
      data: { email: 'admin3@example.com', passwordHash: 'x', name: 'Admin 3 sem telefone', role: 'ADMIN' },
    });
    await db.user.create({
      data: { email: 'agent@example.com', passwordHash: 'x', name: 'Agente', role: 'AGENT', phone: '5511900000003' },
    });

    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0)); // Monday 10:00 local
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0)); // Monday 10:30 local, 30 business minutes elapsed
    const conversation = await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        customerName: 'Cliente Teste',
        status: 'QUEUED',
        lastInboundAt,
      },
    });

    const result = await escalateOverdueConversations(now);

    expect(result).toEqual({ escalated: 1 });
    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenCalledWith({
      phone: '5511900000001',
      text: `⚠️ SLA estourado: Cliente Teste está aguardando atendimento há mais de 15 min.\nhttps://atende.example.com/painel/conversas/${conversation.id}`,
    });
    expect(sendText).toHaveBeenCalledWith({
      phone: '5511900000002',
      text: `⚠️ SLA estourado: Cliente Teste está aguardando atendimento há mais de 15 min.\nhttps://atende.example.com/painel/conversas/${conversation.id}`,
    });

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.slaEscalatedAt).not.toBeNull();
  });

  it('falls back to customerExternalId when customerName is null', async () => {
    vi.stubEnv('SLA_MINUTES', '15');
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');
    vi.mocked(sendText).mockResolvedValue({ id: 'EVO1' });
    await db.user.create({
      data: { email: 'admin1@example.com', passwordHash: 'x', name: 'Admin 1', role: 'ADMIN', phone: '5511900000001' },
    });
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED', lastInboundAt },
    });

    await escalateOverdueConversations(now);

    expect(sendText).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('SLA estourado: 5511999999999') })
    );
  });

  it('marks the conversation escalated even when no admin has a phone on file', async () => {
    vi.stubEnv('SLA_MINUTES', '15');
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');
    await db.user.create({
      data: { email: 'admin1@example.com', passwordHash: 'x', name: 'Admin sem telefone', role: 'ADMIN' },
    });
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED', lastInboundAt },
    });

    const result = await escalateOverdueConversations(now);

    expect(result).toEqual({ escalated: 1 });
    expect(sendText).not.toHaveBeenCalled();
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.slaEscalatedAt).not.toBeNull();
  });

  it('keeps sending to remaining admins and still marks the conversation escalated when one send fails', async () => {
    vi.stubEnv('SLA_MINUTES', '15');
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');
    vi.mocked(sendText)
      .mockRejectedValueOnce(new Error('Evolution API down'))
      .mockResolvedValueOnce({ id: 'EVO1' });
    await db.user.create({
      data: { email: 'admin1@example.com', passwordHash: 'x', name: 'Admin 1', role: 'ADMIN', phone: '5511900000001' },
    });
    await db.user.create({
      data: { email: 'admin2@example.com', passwordHash: 'x', name: 'Admin 2', role: 'ADMIN', phone: '5511900000002' },
    });
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED', lastInboundAt },
    });

    const result = await escalateOverdueConversations(now);

    expect(result).toEqual({ escalated: 1 });
    expect(sendText).toHaveBeenCalledTimes(2);
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.slaEscalatedAt).not.toBeNull();
  });

  it('falls back to the 15-minute default (not 0) when SLA_MINUTES is set to an empty string', async () => {
    vi.stubEnv('SLA_MINUTES', '');
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');
    await db.user.create({
      data: { email: 'admin1@example.com', passwordHash: 'x', name: 'Admin 1', role: 'ADMIN', phone: '5511900000001' },
    });
    const lastInboundAt = new Date(Date.UTC(2026, 8, 7, 13, 0, 0)); // Monday 10:00 local
    const now = new Date(Date.UTC(2026, 8, 7, 13, 5, 0)); // Monday 10:05 local, only 5 business minutes elapsed
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'QUEUED', lastInboundAt },
    });

    const result = await escalateOverdueConversations(now);

    expect(result).toEqual({ escalated: 0 });
    expect(sendText).not.toHaveBeenCalled();
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.slaEscalatedAt).toBeNull();
  });

  it('returns escalated: 0 and sends nothing when there are no overdue conversations', async () => {
    vi.stubEnv('SLA_MINUTES', '15');
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');

    const result = await escalateOverdueConversations(new Date());

    expect(result).toEqual({ escalated: 0 });
    expect(sendText).not.toHaveBeenCalled();
  });
});
