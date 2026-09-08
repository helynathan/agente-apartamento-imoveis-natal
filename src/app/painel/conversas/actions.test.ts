import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/realtime/broadcast', () => ({
  broadcastEvent: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { claimConversationAction, closeConversationAction, sendMessageAction } from './actions';

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe('painel/conversas actions', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.outboundMessage.deleteMany();
    await db.message.deleteMany();
    await db.conversation.deleteMany();
    await db.sector.deleteMany();
    await db.user.deleteMany();
  });

  describe('claimConversationAction', () => {
    it('sends an intro message naming the attendant after successfully claiming', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1', name: 'Maria' } } as never);

      const sector = await db.sector.create({ data: { name: 'Comercial' } });
      const conversation = await db.conversation.create({
        data: { customerExternalId: '5511999999999', status: 'QUEUED' },
      });

      const formData = formDataFrom({ conversationId: conversation.id, sectorId: sector.id });

      await expect(claimConversationAction(formData)).rejects.toThrow(
        `REDIRECT:/painel/conversas/${conversation.id}`,
      );

      const outboundMessages = await db.outboundMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(outboundMessages).toHaveLength(1);
      expect(outboundMessages[0]).toMatchObject({
        content: 'Você está sendo atendido(a) por Maria agora.',
        status: 'PENDING',
      });
    });

    it('falls back to a generic label when the attendant has no name on the session', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1', name: null } } as never);

      const sector = await db.sector.create({ data: { name: 'Comercial' } });
      const conversation = await db.conversation.create({
        data: { customerExternalId: '5511999999999', status: 'QUEUED' },
      });

      const formData = formDataFrom({ conversationId: conversation.id, sectorId: sector.id });

      await expect(claimConversationAction(formData)).rejects.toThrow(
        `REDIRECT:/painel/conversas/${conversation.id}`,
      );

      const outboundMessages = await db.outboundMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(outboundMessages).toHaveLength(1);
      expect(outboundMessages[0]).toMatchObject({
        content: 'Você está sendo atendido(a) por um atendente agora.',
        status: 'PENDING',
      });
    });

    it('does not enqueue an intro message when the claim fails (already assigned)', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1', name: 'Maria' } } as never);

      const otherUser = await db.user.create({
        data: { email: 'outro@example.com', passwordHash: 'x', name: 'Outro' },
      });
      const sector = await db.sector.create({ data: { name: 'Comercial' } });
      const conversation = await db.conversation.create({
        data: { customerExternalId: '5511999999999', status: 'ASSIGNED', assignedUserId: otherUser.id },
      });

      const formData = formDataFrom({ conversationId: conversation.id, sectorId: sector.id });

      await expect(claimConversationAction(formData)).rejects.toThrow(
        'Esta conversa já foi assumida por outro atendente.',
      );

      const outboundMessages = await db.outboundMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(outboundMessages).toHaveLength(0);
    });
  });

  describe('closeConversationAction', () => {
    it('broadcasts both queue:updated and conversation:updated', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);

      const conversation = await db.conversation.create({
        data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
      });

      const formData = formDataFrom({ conversationId: conversation.id });

      await expect(closeConversationAction(formData)).rejects.toThrow('REDIRECT:/painel');

      const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
      expect(updated?.status).toBe('CLOSED');

      expect(broadcastEvent).toHaveBeenCalledWith({ type: 'queue:updated' });
      expect(broadcastEvent).toHaveBeenCalledWith({
        type: 'conversation:updated',
        conversationId: conversation.id,
      });
    });
  });

  describe('sendMessageAction', () => {
    it('rejects sending a message into a CLOSED conversation', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);

      const conversation = await db.conversation.create({
        data: { customerExternalId: '5511999999999', status: 'CLOSED' },
      });

      const formData = formDataFrom({ conversationId: conversation.id, content: 'Olá' });

      await expect(sendMessageAction(formData)).rejects.toThrow(
        'Não é possível enviar mensagem para uma conversa encerrada.',
      );

      const outboundMessages = await db.outboundMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(outboundMessages).toHaveLength(0);
    });

    it('enqueues the message when the conversation is not CLOSED', async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);

      const conversation = await db.conversation.create({
        data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
      });

      const formData = formDataFrom({ conversationId: conversation.id, content: 'Olá' });

      await sendMessageAction(formData);

      const outboundMessages = await db.outboundMessage.findMany({
        where: { conversationId: conversation.id },
      });
      expect(outboundMessages).toHaveLength(1);
      expect(outboundMessages[0]).toMatchObject({ content: 'Olá', status: 'PENDING' });
    });
  });
});
