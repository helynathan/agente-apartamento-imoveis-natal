import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/ai/requestCopilotSuggestion', () => ({
  requestCopilotSuggestion: vi.fn(),
}));

vi.mock('@/lib/products/searchRelevantProducts', () => ({
  searchRelevantProducts: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { requestCopilotSuggestion } from '@/lib/ai/requestCopilotSuggestion';
import { searchRelevantProducts } from '@/lib/products/searchRelevantProducts';
import { generateCopilotSuggestionAction } from './copilotActions';

describe('generateCopilotSuggestionAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.message.deleteMany();
    await db.outboundMessage.deleteMany();
    await db.conversation.deleteMany();
  });

  it('rejects when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(generateCopilotSuggestionAction('any-id')).rejects.toThrow('Não autenticado.');
    expect(requestCopilotSuggestion).not.toHaveBeenCalled();
  });

  it('returns the suggestion on success', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', content: 'Preciso de ajuda' },
    });
    vi.mocked(requestCopilotSuggestion).mockResolvedValue('Claro, posso ajudar!');

    const result = await generateCopilotSuggestionAction(conversation.id);

    expect(result).toEqual({ suggestion: 'Claro, posso ajudar!' });
    expect(requestCopilotSuggestion).toHaveBeenCalledWith({
      messages: [{ direction: 'INBOUND', content: 'Preciso de ajuda' }],
    });
  });

  it('returns an error object when the AI call fails, without throwing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
    });
    vi.mocked(requestCopilotSuggestion).mockRejectedValue(new Error('OpenAI down'));

    const result = await generateCopilotSuggestionAction(conversation.id);

    expect(result).toEqual({ error: 'Não foi possível gerar uma sugestão agora.' });
  });

  it('returns an error when the conversation does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);

    const result = await generateCopilotSuggestionAction('does-not-exist');

    expect(result).toEqual({ error: 'Conversa não encontrada.' });
    expect(requestCopilotSuggestion).not.toHaveBeenCalled();
  });

  it('passes productContext built from the last inbound message when products are found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', content: 'Tem apartamento em Petrópolis?' },
    });
    vi.mocked(searchRelevantProducts).mockResolvedValue([
      { url: 'https://example.com/10001', content: 'Apartamento em Petrópolis, Natal' },
    ]);
    vi.mocked(requestCopilotSuggestion).mockResolvedValue('Temos sim!');

    await generateCopilotSuggestionAction(conversation.id);

    expect(searchRelevantProducts).toHaveBeenCalledWith('Tem apartamento em Petrópolis?', 3);
    expect(requestCopilotSuggestion).toHaveBeenCalledWith({
      messages: [{ direction: 'INBOUND', content: 'Tem apartamento em Petrópolis?' }],
      productContext: '- https://example.com/10001: Apartamento em Petrópolis, Natal',
    });
  });

  it('still returns a suggestion when product search fails', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
    const conversation = await db.conversation.create({
      data: { customerExternalId: '5511999999999', status: 'ASSIGNED' },
    });
    await db.message.create({
      data: { conversationId: conversation.id, direction: 'INBOUND', content: 'Oi' },
    });
    vi.mocked(searchRelevantProducts).mockRejectedValue(new Error('DB down'));
    vi.mocked(requestCopilotSuggestion).mockResolvedValue('Olá!');

    const result = await generateCopilotSuggestionAction(conversation.id);

    expect(result).toEqual({ suggestion: 'Olá!' });
    expect(requestCopilotSuggestion).toHaveBeenCalledWith({
      messages: [{ direction: 'INBOUND', content: 'Oi' }],
      productContext: undefined,
    });
  });
});
