import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: { create: mockCreate },
  })),
}));

import { requestEmbedding } from '@/lib/ai/requestEmbedding';

describe('requestEmbedding', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mockCreate.mockReset();
  });

  it('returns the embedding vector', async () => {
    mockCreate.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });

    const result = await requestEmbedding('Produto X');

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(mockCreate).toHaveBeenCalledWith({ model: 'text-embedding-3-small', input: 'Produto X' });
  });

  it('throws when the response has no data', async () => {
    mockCreate.mockResolvedValue({ data: [] });

    await expect(requestEmbedding('Produto X')).rejects.toThrow('OpenAI embeddings response has no data');
  });
});
