import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { requestCopilotSuggestion } from '@/lib/ai/requestCopilotSuggestion';

describe('requestCopilotSuggestion', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockCreate.mockReset();
  });

  it('returns the suggested reply text', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Claro, posso te ajudar com isso!' } }],
    });

    const result = await requestCopilotSuggestion({
      messages: [{ direction: 'INBOUND', content: 'Preciso de ajuda com meu pedido' }],
    });

    expect(result).toBe('Claro, posso te ajudar com isso!');
  });

  it('sends the conversation history as chat messages', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

    await requestCopilotSuggestion({
      messages: [
        { direction: 'INBOUND', content: 'Oi' },
        { direction: 'OUTBOUND', content: 'Olá! Como posso ajudar?' },
      ],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Oi' }),
          expect.objectContaining({ role: 'assistant', content: 'Olá! Como posso ajudar?' }),
        ]),
      })
    );
  });

  it('throws when the response has no content', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: {} }] });

    await expect(requestCopilotSuggestion({ messages: [] })).rejects.toThrow(
      'OpenAI response has no content'
    );
  });

  it('includes productContext in the system prompt when provided', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

    await requestCopilotSuggestion({
      messages: [{ direction: 'INBOUND', content: 'Tem apartamento em Petrópolis?' }],
      productContext: '- https://example.com/10001: Apartamento em Petrópolis, Natal',
    });

    const call = mockCreate.mock.calls[0][0];
    const systemMessage = call.messages[0].content as string;
    expect(systemMessage).toContain('Apartamento em Petrópolis, Natal');
  });

  it('omits product context from the prompt when not provided', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

    await requestCopilotSuggestion({ messages: [{ direction: 'INBOUND', content: 'Oi' }] });

    const call = mockCreate.mock.calls[0][0];
    const systemMessage = call.messages[0].content as string;
    expect(systemMessage).not.toContain('produtos relevantes');
  });
});
