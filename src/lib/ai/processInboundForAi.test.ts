import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/ai/openaiClient', () => ({
  requestTriageDecision: vi.fn(),
}));
vi.mock('@/lib/queue/enqueueOutboundMessage', () => ({
  enqueueOutboundMessage: vi.fn().mockResolvedValue({ id: 'om1' }),
}));
vi.mock('@/lib/realtime/broadcast', () => ({
  broadcastEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/products/searchRelevantProducts', () => ({
  searchRelevantProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/crm/notifyLeadToCrm', () => ({
  notifyLeadToCrm: vi.fn().mockResolvedValue(undefined),
}));

import { requestTriageDecision } from '@/lib/ai/openaiClient';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';
import { searchRelevantProducts } from '@/lib/products/searchRelevantProducts';
import { notifyLeadToCrm } from '@/lib/crm/notifyLeadToCrm';
import { processInboundForAi } from '@/lib/ai/processInboundForAi';

describe('processInboundForAi', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.mocked(notifyLeadToCrm).mockResolvedValue(undefined);
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.conversation.deleteMany();
    await db.sector.deleteMany();
  });

  it('enqueues the AI reply and stays in AI_HANDLING for a "responder" decision', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Pode me dar mais detalhes?',
      eLead: false,
    });

    await processInboundForAi(conversation.id);

    expect(enqueueOutboundMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      content: 'Pode me dar mais detalhes?',
    });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('AI_HANDLING');
  });

  it('hands off to QUEUED with the chosen sector for an "encaminhar" decision', async () => {
    const sector = await db.sector.create({ data: { name: 'Financeiro' } });
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 2 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'encaminhar',
      mensagem: 'Vou te encaminhar para o financeiro.',
      sectorId: sector.id,
      eLead: false,
    });

    await processInboundForAi(conversation.id);

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('QUEUED');
    expect(updated?.sectorId).toBe(sector.id);
    expect(updated?.aiMessageCount).toBe(0);
  });

  it('forces handoff to QUEUED without calling the AI once aiMessageCount reaches 6', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 6 },
    });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).not.toHaveBeenCalled();
    expect(enqueueOutboundMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      content: 'Vou te encaminhar para um atendente, só um momento.',
    });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('QUEUED');
    expect(updated?.sectorId).toBeNull();
  });

  it('falls back to QUEUED with the fixed message when the AI call fails', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockRejectedValue(new Error('OpenAI down'));

    await processInboundForAi(conversation.id);

    expect(enqueueOutboundMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      content: 'Vou te encaminhar para um atendente, só um momento.',
    });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('QUEUED');
    expect(updated?.sectorId).toBeNull();
  });

  it('includes pending outbound messages as assistant turns in chronological order', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    await db.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: 'Oi, tudo bem?',
      },
    });
    await db.outboundMessage.create({
      data: {
        conversationId: conversation.id,
        content: 'Tudo sim, como posso ajudar?',
        status: 'PENDING',
      },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Só um momento.',
      eLead: false,
    });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).toHaveBeenCalledWith({
      messages: [
        { direction: 'INBOUND', content: 'Oi, tudo bem?' },
        { direction: 'OUTBOUND', content: 'Tudo sim, como posso ajudar?' },
      ],
      sectors: [],
      channel: 'WHATSAPP',
      hasLeadPhone: true,
    });
  });

  it('includes relevant product context when the search succeeds', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', content: 'Vocês têm o produto X?' },
    });
    vi.mocked(searchRelevantProducts).mockResolvedValue([
      { url: 'https://example.com/produto-x', content: 'Produto X, ótimo custo-benefício.' },
    ]);
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Sim, temos!', eLead: false });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        productContext: expect.stringContaining('Produto X, ótimo custo-benefício'),
      })
    );
  });

  it('proceeds without product context when the search fails', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', content: 'Oi' },
    });
    vi.mocked(searchRelevantProducts).mockRejectedValue(new Error('embedding down'));
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Olá!', eLead: false });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).toHaveBeenCalledWith(
      expect.objectContaining({ productContext: undefined })
    );
  });

  it('does nothing when the conversation is not in AI_HANDLING', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
    });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).not.toHaveBeenCalled();
    expect(enqueueOutboundMessage).not.toHaveBeenCalled();
  });

  it('notifies the CRM, marks crmSyncedAt and closes the conversation when the decision has eLead true', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', customerName: 'Cliente Teste', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Vou te ajudar a encontrar um imóvel.',
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    expect(notifyLeadToCrm).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: '5511999999999', nome: 'Cliente Teste' })
    );
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.crmSyncedAt).not.toBeNull();
    expect(updated?.status).toBe('CLOSED');
  });

  it('includes a link to the conversation in the CRM payload', async () => {
    vi.stubEnv('NEXTAUTH_URL', 'https://atende.example.com');
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', customerName: 'Cliente Teste', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Vou te ajudar a encontrar um imóvel.',
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    expect(notifyLeadToCrm).toHaveBeenCalledWith(
      expect.objectContaining({ link: `https://atende.example.com/painel/conversas/${conversation.id}` })
    );
  });

  it('sends canal "WhatsApp" for WhatsApp leads and "Instagram" for Instagram leads', async () => {
    const whatsapp = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Olá!', eLead: true });
    await processInboundForAi(whatsapp.id);
    expect(notifyLeadToCrm).toHaveBeenCalledWith(expect.objectContaining({ canal: 'WhatsApp' }));

    vi.mocked(notifyLeadToCrm).mockClear();
    const instagram = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1', aiMessageCount: 1, leadPhone: '5511988887777' },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Olá!', eLead: true });
    await processInboundForAi(instagram.id);
    expect(notifyLeadToCrm).toHaveBeenCalledWith(expect.objectContaining({ canal: 'Instagram' }));
  });

  it('does not hand off to the queue when the CRM sync fails', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Vou verificar para você.',
      eLead: true,
    });
    vi.mocked(notifyLeadToCrm).mockRejectedValue(new Error('n8n down'));

    await processInboundForAi(conversation.id);

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('AI_HANDLING');
  });

  it('closes the conversation, keeping the chosen sector, when a decision that already encaminhou also syncs a lead to the CRM', async () => {
    const sector = await db.sector.create({ data: { name: 'Comercial' } });
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'encaminhar',
      mensagem: 'Vou te encaminhar para o comercial.',
      sectorId: sector.id,
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('CLOSED');
    expect(updated?.sectorId).toBe(sector.id);
  });

  it('does not notify the CRM again when crmSyncedAt is already set', async () => {
    const conversation = await db.conversation.create({
      data: {
        customerExternalId: '5511999999999',
        aiMessageCount: 1,
        crmSyncedAt: new Date(),
      },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Claro, temos disponibilidade.',
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    expect(notifyLeadToCrm).not.toHaveBeenCalled();
  });

  it('does not notify the CRM when eLead is false', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Olá!',
      eLead: false,
    });

    await processInboundForAi(conversation.id);

    expect(notifyLeadToCrm).not.toHaveBeenCalled();
  });

  it('records crmSyncError without blocking the AI response when CRM notification fails', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Vou verificar para você.',
      eLead: true,
    });
    vi.mocked(notifyLeadToCrm).mockRejectedValue(new Error('n8n down'));

    await processInboundForAi(conversation.id);

    expect(enqueueOutboundMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      content: 'Vou verificar para você.',
    });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.crmSyncError).toBe('n8n down');
    expect(updated?.crmSyncedAt).toBeNull();
    expect(updated?.status).toBe('AI_HANDLING');
  });

  it('does not leak a crmSyncError DB write failure into the AI-failure fallback path', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Vou verificar para você.',
      eLead: true,
    });
    vi.mocked(notifyLeadToCrm).mockRejectedValue(new Error('n8n down'));

    const originalUpdate = db.conversation.update.bind(db.conversation);
    let updateCallCount = 0;
    db.conversation.update = vi.fn((...args: Parameters<typeof originalUpdate>) => {
      updateCallCount += 1;
      if (updateCallCount === 1) {
        return Promise.reject(new Error('transient DB error'));
      }
      return originalUpdate(...args);
    }) as unknown as typeof db.conversation.update;

    try {
      await processInboundForAi(conversation.id);
    } finally {
      db.conversation.update = originalUpdate;
    }

    expect(enqueueOutboundMessage).toHaveBeenCalledTimes(1);
    expect(enqueueOutboundMessage).toHaveBeenCalledWith({
      conversationId: conversation.id,
      content: 'Vou verificar para você.',
    });
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.status).toBe('AI_HANDLING');
  });

  it('uses the destination sector name as interesse when the decision is encaminhar', async () => {
    const sector = await db.sector.create({ data: { name: 'Locação' } });
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'encaminhar',
      mensagem: 'Vou te encaminhar para locação.',
      sectorId: sector.id,
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    expect(notifyLeadToCrm).toHaveBeenCalledWith(expect.objectContaining({ interesse: 'Locação' }));
  });

  it('passes channel and hasLeadPhone true for WhatsApp conversations', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Olá!', eLead: false });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'WHATSAPP', hasLeadPhone: true })
    );
  });

  it('passes hasLeadPhone false for a fresh Instagram conversation with no leadPhone yet', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Pode me passar seu telefone?',
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'INSTAGRAM', hasLeadPhone: false })
    );
    expect(notifyLeadToCrm).not.toHaveBeenCalled();
  });

  it('saves telefoneCapturado to leadPhone and syncs the CRM for Instagram once a phone is captured', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1', customerName: 'Cliente IG', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Obrigado! Alguém vai te chamar.',
      eLead: true,
      telefoneCapturado: '5511988887777',
    });

    await processInboundForAi(conversation.id);

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.leadPhone).toBe('5511988887777');
    expect(notifyLeadToCrm).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: '5511988887777', nome: 'Cliente IG' })
    );
    expect(updated?.crmSyncedAt).not.toBeNull();
  });

  it('does not sync the CRM for Instagram when eLead is true but no phone has been captured yet', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Pode me passar seu telefone?',
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    expect(notifyLeadToCrm).not.toHaveBeenCalled();
    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.leadPhone).toBeNull();
  });

  it('remembers eLead across turns so a later-arriving phone still syncs the CRM lead on Instagram', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1', customerName: 'Cliente IG', aiMessageCount: 1, isLead: true },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Obrigado! Alguém vai te chamar.',
      eLead: false,
      telefoneCapturado: '5511988887777',
    });

    await processInboundForAi(conversation.id);

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.leadPhone).toBe('5511988887777');
    expect(notifyLeadToCrm).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: '5511988887777', nome: 'Cliente IG' })
    );
    expect(updated?.crmSyncedAt).not.toBeNull();
  });

  it('persists isLead on the first turn eLead is true, even before a phone is captured', async () => {
    const conversation = await db.conversation.create({
      data: { channel: 'INSTAGRAM', customerExternalId: 'ig-user-1', aiMessageCount: 1 },
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({
      acao: 'responder',
      mensagem: 'Pode me passar seu telefone?',
      eLead: true,
    });

    await processInboundForAi(conversation.id);

    const updated = await db.conversation.findUnique({ where: { id: conversation.id } });
    expect(updated?.isLead).toBe(true);
    expect(notifyLeadToCrm).not.toHaveBeenCalled();
  });
});
