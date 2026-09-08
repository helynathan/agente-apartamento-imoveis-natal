// src/lib/ai/openaiClient.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { requestTriageDecision } from '@/lib/ai/openaiClient';

describe('requestTriageDecision', () => {
  const sectors = [{ id: 'sec1', name: 'Financeiro' }];

  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockCreate.mockReset();
  });

  it('returns a parsed decision for a valid "responder" response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ acao: 'responder', mensagem: 'Olá! Como posso ajudar?', sectorId: null, eLead: false }),
          },
        },
      ],
    });

    const result = await requestTriageDecision({
      messages: [{ direction: 'INBOUND', content: 'Oi' }],
      sectors,
    });

    expect(result).toEqual({ acao: 'responder', mensagem: 'Olá! Como posso ajudar?', sectorId: undefined, eLead: false });
  });

  it('returns a parsed decision for a valid "encaminhar" response with a known sectorId', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ acao: 'encaminhar', mensagem: 'Vou te encaminhar.', sectorId: 'sec1', eLead: true }),
          },
        },
      ],
    });

    const result = await requestTriageDecision({
      messages: [{ direction: 'INBOUND', content: 'Quero cancelar' }],
      sectors,
    });

    expect(result).toEqual({ acao: 'encaminhar', mensagem: 'Vou te encaminhar.', sectorId: 'sec1', eLead: true });
  });

  it('throws when acao is "encaminhar" but sectorId is missing', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'encaminhar', mensagem: 'Vou encaminhar.', sectorId: null }) } },
      ],
    });

    await expect(requestTriageDecision({ messages: [], sectors })).rejects.toThrow(/sectorId/);
  });

  it('throws when acao is "encaminhar" but sectorId does not match a known sector', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: { content: JSON.stringify({ acao: 'encaminhar', mensagem: 'Vou encaminhar.', sectorId: 'unknown' }) },
        },
      ],
    });

    await expect(requestTriageDecision({ messages: [], sectors })).rejects.toThrow(/sectorId/);
  });

  it('throws when acao is not one of the allowed values', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ acao: 'invalido', mensagem: 'x', sectorId: null }) } }],
    });

    await expect(requestTriageDecision({ messages: [], sectors })).rejects.toThrow(/acao/);
  });

  it('throws when the response has no content', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: {} }] });

    await expect(requestTriageDecision({ messages: [], sectors })).rejects.toThrow('OpenAI response has no content');
  });

  it('includes product context in the system prompt when provided', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Sim, temos!', sectorId: null, eLead: false }) } },
      ],
    });

    await requestTriageDecision({
      messages: [{ direction: 'INBOUND', content: 'Vocês têm o produto X?' }],
      sectors: [],
      productContext: '- https://example.com/produto-x: Produto X, ótimo custo-benefício.',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Produto X, ótimo custo-benefício'),
          }),
        ]),
      })
    );
  });

  it('mentions the lead criteria (imóvel or product interest) in the system prompt', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null, eLead: false }) } },
      ],
    });

    await requestTriageDecision({ messages: [{ direction: 'INBOUND', content: 'Oi' }], sectors: [] });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('imóvel'),
          }),
        ]),
      })
    );
  });

  it('includes guidance mapping common customer scenarios to Administrativo, Comercial and Financeiro in the system prompt', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null, eLead: false }) } },
      ],
    });

    await requestTriageDecision({ messages: [{ direction: 'INBOUND', content: 'Oi' }], sectors: [] });

    const call = mockCreate.mock.calls[0][0];
    const systemMessage = call.messages[0].content as string;
    expect(systemMessage).toContain('colocar um imóvel para alugar');
    expect(systemMessage).toContain('Administrativo');
    expect(systemMessage).toContain('comprar ou alugar um imóvel');
    expect(systemMessage).toContain('Comercial');
    expect(systemMessage).toContain('boleto');
    expect(systemMessage).toContain('Financeiro');
  });

  it('throws when eLead is missing or not a boolean', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null }) } },
      ],
    });

    await expect(requestTriageDecision({ messages: [], sectors: [] })).rejects.toThrow(/eLead/);
  });

  it('asks for a phone number in the prompt when channel is INSTAGRAM and no lead phone is known yet', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              acao: 'responder',
              mensagem: 'Pode me passar seu telefone?',
              sectorId: null,
              eLead: true,
              telefoneCapturado: null,
            }),
          },
        },
      ],
    });

    await requestTriageDecision({
      messages: [{ direction: 'INBOUND', content: 'Quero saber mais sobre o imóvel' }],
      sectors: [],
      channel: 'INSTAGRAM',
      hasLeadPhone: false,
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: expect.stringContaining('peça o telefone') }),
        ]),
      })
    );
  });

  it('does not ask for a phone number when channel is INSTAGRAM but a lead phone is already known', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Claro!', sectorId: null, eLead: true, telefoneCapturado: null }) } },
      ],
    });

    await requestTriageDecision({
      messages: [{ direction: 'INBOUND', content: 'Quero saber mais' }],
      sectors: [],
      channel: 'INSTAGRAM',
      hasLeadPhone: true,
    });

    const call = mockCreate.mock.calls[0][0];
    const systemMessage = call.messages[0].content as string;
    expect(systemMessage).not.toContain('peça o telefone');
  });

  it('does not ask for a phone number on the WhatsApp channel even without hasLeadPhone set', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null, eLead: false }) } },
      ],
    });

    await requestTriageDecision({ messages: [{ direction: 'INBOUND', content: 'Oi' }], sectors: [] });

    const call = mockCreate.mock.calls[0][0];
    const systemMessage = call.messages[0].content as string;
    expect(systemMessage).not.toContain('peça o telefone');
  });

  it('parses telefoneCapturado when the AI identifies a phone in the message', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              acao: 'responder',
              mensagem: 'Obrigado!',
              sectorId: null,
              eLead: true,
              telefoneCapturado: '5511988887777',
            }),
          },
        },
      ],
    });

    const result = await requestTriageDecision({
      messages: [{ direction: 'INBOUND', content: 'Meu telefone é 5511988887777' }],
      sectors: [],
      channel: 'INSTAGRAM',
      hasLeadPhone: false,
    });

    expect(result.telefoneCapturado).toBe('5511988887777');
  });

  it('defaults to no telefoneCapturado when the field is absent from the AI response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null, eLead: false }) } }],
    });

    const result = await requestTriageDecision({ messages: [], sectors: [] });

    expect(result.telefoneCapturado).toBeUndefined();
  });

  it('throws when telefoneCapturado is present but not a string', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null, eLead: false, telefoneCapturado: 123 }) } },
      ],
    });

    await expect(requestTriageDecision({ messages: [], sectors: [] })).rejects.toThrow(/telefoneCapturado/);
  });

  it('opens the prompt with "via Instagram" when channel is INSTAGRAM', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ acao: 'responder', mensagem: 'Olá!', sectorId: null, eLead: false }) } }],
    });

    await requestTriageDecision({ messages: [], sectors: [], channel: 'INSTAGRAM' });

    const call = mockCreate.mock.calls[0][0];
    const systemMessage = call.messages[0].content as string;
    expect(systemMessage).toContain('via Instagram');
    expect(systemMessage).not.toContain('via WhatsApp');
  });
});
