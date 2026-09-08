import { describe, it, expect, vi, afterEach } from 'vitest';
import { broadcastEvent } from '@/lib/realtime/broadcast';

describe('broadcastEvent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('never throws, even when the underlying fetch rejects', async () => {
    vi.stubEnv('REALTIME_INTERNAL_URL', 'http://localhost:4001');
    vi.stubEnv('REALTIME_SECRET', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(broadcastEvent({ type: 'queue:updated' })).resolves.toBeUndefined();
  });

  it('does nothing when REALTIME_INTERNAL_URL is not set', async () => {
    vi.stubEnv('REALTIME_INTERNAL_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await broadcastEvent({ type: 'queue:updated' });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the shared secret header from REALTIME_SECRET', async () => {
    vi.stubEnv('REALTIME_INTERNAL_URL', 'http://localhost:4001');
    vi.stubEnv('REALTIME_SECRET', 'test-secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await broadcastEvent({ type: 'queue:updated' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4001/broadcast',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-realtime-secret': 'test-secret' }),
      })
    );
  });
});
