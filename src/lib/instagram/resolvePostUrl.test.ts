import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolvePostUrl } from '@/lib/instagram/resolvePostUrl';

describe('resolvePostUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts the postUrl and returns the mediaId from the response', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', 'https://n8n.example.com/webhook/resolve-post-url');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ mediaId: '17841409145832360_123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolvePostUrl('https://www.instagram.com/p/ABC123/');

    expect(result).toEqual({ mediaId: '17841409145832360_123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/resolve-post-url',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        signal: expect.any(AbortSignal),
        body: JSON.stringify({ postUrl: 'https://www.instagram.com/p/ABC123/' }),
      })
    );
  });

  it('throws when N8N_RESOLVE_POST_URL_WEBHOOK_URL is not configured', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', '');

    await expect(resolvePostUrl('https://www.instagram.com/p/ABC123/')).rejects.toThrow(
      'N8N_RESOLVE_POST_URL_WEBHOOK_URL is not configured'
    );
  });

  it('throws when the webhook responds with a non-ok status', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', 'https://n8n.example.com/webhook/resolve-post-url');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(resolvePostUrl('https://www.instagram.com/p/inexistente/')).rejects.toThrow('HTTP 404');
  });

  it('throws when the response has no mediaId', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', 'https://n8n.example.com/webhook/resolve-post-url');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }));

    await expect(resolvePostUrl('https://www.instagram.com/p/ABC123/')).rejects.toThrow('did not return a mediaId');
  });
});
