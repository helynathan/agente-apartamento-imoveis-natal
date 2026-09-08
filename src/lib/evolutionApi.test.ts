import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendText, fetchProfilePictureUrl } from '@/lib/evolutionApi';

describe('sendText', () => {
  beforeEach(() => {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example.com');
    vi.stubEnv('EVOLUTION_API_KEY', 'test-key');
    vi.stubEnv('EVOLUTION_INSTANCE', 'test-instance');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls the Evolution API and returns the message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ key: { id: 'MSG123' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendText({ phone: '5511999999999', text: 'Olá' });

    expect(result).toEqual({ id: 'MSG123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://evo.example.com/message/sendText/test-instance',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'test-key' }),
      })
    );
  });

  it('throws when the API responds with an error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendText({ phone: '5511999999999', text: 'Olá' })).rejects.toThrow(
      'Evolution API error (500): internal error'
    );
  });

  it('resolves with an empty id when the API returns a 2xx response with a malformed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'unexpected shape' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendText({ phone: '5511999999999', text: 'Olá' })).resolves.toEqual({ id: '' });
  });

  it('resolves with an empty id when key.id is missing entirely', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendText({ phone: '5511999999999', text: 'Olá' })).resolves.toEqual({ id: '' });
  });
});

describe('fetchProfilePictureUrl', () => {
  beforeEach(() => {
    vi.stubEnv('EVOLUTION_API_URL', 'https://evo.example.com');
    vi.stubEnv('EVOLUTION_API_KEY', 'test-key');
    vi.stubEnv('EVOLUTION_INSTANCE', 'test-instance');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('calls the Evolution API and returns the profile picture URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profilePictureUrl: 'https://evo.example.com/pic.jpg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProfilePictureUrl('5511999999999');

    expect(result).toBe('https://evo.example.com/pic.jpg');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://evo.example.com/chat/fetchProfilePictureUrl/test-instance',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ apikey: 'test-key' }),
        body: JSON.stringify({ number: '5511999999999' }),
      })
    );
  });

  it('returns null when the API responds with an error status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfilePictureUrl('5511999999999')).resolves.toBeNull();
  });

  it('returns null when the response has no profilePictureUrl field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfilePictureUrl('5511999999999')).resolves.toBeNull();
  });

  it('throws when Evolution API environment variables are not configured', async () => {
    vi.stubEnv('EVOLUTION_API_URL', '');

    await expect(fetchProfilePictureUrl('5511999999999')).rejects.toThrow(
      'Evolution API environment variables are not configured'
    );
  });
});
