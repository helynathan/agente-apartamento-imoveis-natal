import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendInstagramMessage } from '@/lib/instagram/sendInstagramMessage';

describe('sendInstagramMessage', () => {
  beforeEach(() => {
    vi.stubEnv('N8N_INSTAGRAM_SEND_WEBHOOK_URL', 'https://n8n.example.com/webhook/ig-send');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('posts to the configured webhook and returns the message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'IGM999' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendInstagramMessage({ externalId: 'ig-user-1', text: 'Olá!' });

    expect(result).toEqual({ id: 'IGM999' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://n8n.example.com/webhook/ig-send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ externalId: 'ig-user-1', content: 'Olá!' });
  });

  it('returns an empty id when the response has no id field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const result = await sendInstagramMessage({ externalId: 'ig-user-1', text: 'Olá!' });

    expect(result).toEqual({ id: '' });
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(sendInstagramMessage({ externalId: 'ig-user-1', text: 'Olá!' })).rejects.toThrow('HTTP 500');
  });

  it('throws when N8N_INSTAGRAM_SEND_WEBHOOK_URL is not configured', async () => {
    vi.stubEnv('N8N_INSTAGRAM_SEND_WEBHOOK_URL', '');

    await expect(sendInstagramMessage({ externalId: 'ig-user-1', text: 'Olá!' })).rejects.toThrow(
      'N8N_INSTAGRAM_SEND_WEBHOOK_URL is not configured'
    );
  });
});
