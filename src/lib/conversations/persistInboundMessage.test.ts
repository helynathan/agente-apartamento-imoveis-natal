import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { persistInboundMessage } from '@/lib/conversations/persistInboundMessage';

describe('persistInboundMessage', () => {
  afterEach(async () => {
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.user.deleteMany();
    await db.sector.deleteMany();
    await db.conversation.deleteMany();
  });

  it('creates a new conversation and message when the phone is unknown', async () => {
    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Olá',
      externalId: 'MSG1',
    });

    const conversation = await db.conversation.findUnique({
      where: { id: result.conversationId },
      include: { messages: true },
    });

    expect(conversation?.customerExternalId).toBe('5511999999999');
    expect(conversation?.messages).toHaveLength(1);
    expect(conversation?.messages[0].direction).toBe('INBOUND');
    expect(conversation?.messages[0].content).toBe('Olá');
  });

  it('reuses the existing conversation for a known phone', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira mensagem',
      externalId: 'MSG1',
    });

    const second = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Segunda mensagem',
      externalId: 'MSG2',
    });

    expect(second.conversationId).toBe(first.conversationId);

    const messages = await db.message.findMany({
      where: { conversationId: first.conversationId },
    });
    expect(messages).toHaveLength(2);
  });

  it('sets lastInboundAt on every inbound message', async () => {
    const before = new Date();
    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Olá',
      externalId: 'MSG1',
    });

    const conversation = await db.conversation.findUnique({ where: { id: result.conversationId } });
    expect(conversation?.lastInboundAt).not.toBeNull();
    expect(conversation!.lastInboundAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('resets slaEscalatedAt on a new inbound message', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'QUEUED', slaEscalatedAt: new Date() },
    });

    await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.slaEscalatedAt).toBeNull();
  });

  it('reopens a CLOSED conversation with no previous attendant to AI_HANDLING, clearing sector and resetting the AI counter', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    const sector = await db.sector.create({ data: { name: 'Financeiro' } });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'CLOSED', sectorId: sector.id, assignedUserId: null, aiMessageCount: 4 },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Voltei',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('AI_HANDLING');
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.status).toBe('AI_HANDLING');
    expect(conversation?.sectorId).toBeNull();
    expect(conversation?.assignedUserId).toBeNull();
    expect(conversation?.aiMessageCount).toBe(1);
  });

  it('reopens a CLOSED conversation that had a previous attendant directly to ASSIGNED, keeping the same sector and attendant', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    const sector = await db.sector.create({ data: { name: 'Comercial' } });
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'CLOSED', sectorId: sector.id, assignedUserId: user.id, aiMessageCount: 4 },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Voltei',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('ASSIGNED');
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.status).toBe('ASSIGNED');
    expect(conversation?.sectorId).toBe(sector.id);
    expect(conversation?.assignedUserId).toBe(user.id);
    expect(conversation?.aiMessageCount).toBe(4);
  });

  it('increments aiMessageCount on each message while AI_HANDLING', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    expect(first.status).toBe('AI_HANDLING');
    let conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.aiMessageCount).toBe(1);

    const second = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
    });
    expect(second.status).toBe('AI_HANDLING');
    conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.aiMessageCount).toBe(2);
  });

  it('does not increment aiMessageCount for a conversation that is ASSIGNED', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'ASSIGNED', assignedUserId: user.id },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Mais uma',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('ASSIGNED');
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.aiMessageCount).toBe(1);
  });

  it('leaves an ASSIGNED conversation unchanged in status when a new message arrives', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A' },
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'ASSIGNED', assignedUserId: user.id },
    });

    await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Mais uma',
      externalId: 'MSG2',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.status).toBe('ASSIGNED');
    expect(conversation?.assignedUserId).toBe(user.id);
  });

  it('sets customerName from the provided name on a new conversation', async () => {
    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Olá',
      externalId: 'MSG1',
      name: 'Cliente Teste',
    });

    const conversation = await db.conversation.findUnique({ where: { id: result.conversationId } });
    expect(conversation?.customerName).toBe('Cliente Teste');
  });

  it('updates customerName when a later message includes a new name', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });

    await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
      name: 'Cliente Teste',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.customerName).toBe('Cliente Teste');
  });

  it('keeps the existing customerName when a later message has no name', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
      name: 'Cliente Teste',
    });

    await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.customerName).toBe('Cliente Teste');
  });

  it('signals needsReopenPrompt and marks reopenPromptSentAt when a QUEUED conversation gets a message after 24h of silence', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'QUEUED', lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Voltei depois de um tempo',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('QUEUED');
    expect(result.needsReopenPrompt).toBe(true);
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.reopenPromptSentAt).not.toBeNull();
  });

  it('does not trigger the reopen prompt for a QUEUED conversation within the 24h window', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'QUEUED', lastInboundAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Ainda esperando',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('QUEUED');
    expect(result.needsReopenPrompt).toBeFalsy();
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.reopenPromptSentAt).toBeNull();
  });

  it('reopens to AI_HANDLING when the reply to the prompt indicates a new topic', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    const sector = await db.sector.create({ data: { name: 'Financeiro' } });
    const user = await db.user.create({ data: { email: 'a@example.com', passwordHash: 'x', name: 'A' } });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: {
        status: 'QUEUED',
        sectorId: sector.id,
        assignedUserId: null,
        reopenPromptSentAt: new Date(),
      },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: '2',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('AI_HANDLING');
    expect(result.needsReopenPrompt).toBeFalsy();
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.status).toBe('AI_HANDLING');
    expect(conversation?.sectorId).toBeNull();
    expect(conversation?.aiMessageCount).toBe(1);
    expect(conversation?.reopenPromptSentAt).toBeNull();
  });

  it('stays QUEUED and clears reopenPromptSentAt when the reply is ambiguous', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    await db.conversation.update({
      where: { id: first.conversationId },
      data: { status: 'QUEUED', reopenPromptSentAt: new Date() },
    });

    const result = await persistInboundMessage({
      channel: 'WHATSAPP', phone: '5511999999999',
      text: 'quero continuar',
      externalId: 'MSG2',
    });

    expect(result.status).toBe('QUEUED');
    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.status).toBe('QUEUED');
    expect(conversation?.reopenPromptSentAt).toBeNull();
    expect(conversation?.aiMessageCount).toBe(1);
  });

  it('keeps WhatsApp and Instagram conversations separate even with the same identifier', async () => {
    const whatsapp = await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: 'same-id',
      text: 'Oi do WhatsApp',
      externalId: 'MSG1',
    });
    const instagram = await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'same-id',
      text: 'Oi do Instagram',
      externalId: 'MSG2',
    });

    expect(whatsapp.conversationId).not.toBe(instagram.conversationId);
  });

  it('signals isNewConversation true on the first message and false on later ones', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
    });
    const second = await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
    });

    expect(first.isNewConversation).toBe(true);
    expect(second.isNewConversation).toBe(false);
  });

  it('updates profilePictureUrl when a later message includes a new one', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
      profilePictureUrl: 'https://example.com/foto.jpg',
    });
    await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
      profilePictureUrl: 'https://example.com/foto-diferente.jpg',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.profilePictureUrl).toBe('https://example.com/foto-diferente.jpg');
  });

  it('keeps the existing profilePictureUrl when a later message has none', async () => {
    const first = await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Primeira',
      externalId: 'MSG1',
      profilePictureUrl: 'https://example.com/foto.jpg',
    });
    await persistInboundMessage({
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Segunda',
      externalId: 'MSG2',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.profilePictureUrl).toBe('https://example.com/foto.jpg');
  });

  it('sets originMediaId on a new conversation and never changes it later', async () => {
    const first = await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'ig-user-1',
      text: 'Primeira',
      externalId: 'MSG1',
      originMediaId: 'media-abc',
    });
    await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'ig-user-1',
      text: 'Segunda',
      externalId: 'MSG2',
      originMediaId: 'media-diferente',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.originMediaId).toBe('media-abc');
  });

  it('leaves originMediaId null when not provided on creation', async () => {
    const first = await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'ig-user-2',
      text: 'Primeira',
      externalId: 'MSG3',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.originMediaId).toBeNull();
  });
});
