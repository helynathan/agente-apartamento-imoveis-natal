import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('@/lib/posts/pendingCommentContextRepository', () => ({
  recordPendingCommentContext: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/webhook/instagram-comment/[secret]/route';
import { recordPendingCommentContext } from '@/lib/posts/pendingCommentContextRepository';

function makeRequest(body: unknown, rawBody?: string) {
  return new Request('http://localhost/api/webhook/instagram-comment/correct-secret', {
    method: 'POST',
    body: rawBody ?? JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function callWithSecret(secret: string, body: unknown, rawBody?: string) {
  return POST(makeRequest(body, rawBody), { params: { secret } });
}

describe('POST /api/webhook/instagram-comment/[secret]', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_SECRET', 'correct-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('records the pending comment context when the secret and body are valid', async () => {
    const response = await callWithSecret('correct-secret', { commenterId: 'ig-user-1', mediaId: 'media-abc' });

    expect(response.status).toBe(200);
    expect(recordPendingCommentContext).toHaveBeenCalledWith({ commenterId: 'ig-user-1', mediaId: 'media-abc' });
  });

  it('ignores requests with the wrong secret', async () => {
    await callWithSecret('wrong-secret', { commenterId: 'ig-user-1', mediaId: 'media-abc' });

    expect(recordPendingCommentContext).not.toHaveBeenCalled();
  });

  it('ignores malformed JSON bodies', async () => {
    const response = await callWithSecret('correct-secret', undefined, 'not json');

    expect(response.status).toBe(200);
    expect(recordPendingCommentContext).not.toHaveBeenCalled();
  });

  it('ignores requests missing commenterId', async () => {
    await callWithSecret('correct-secret', { mediaId: 'media-abc' });

    expect(recordPendingCommentContext).not.toHaveBeenCalled();
  });

  it('ignores requests missing mediaId', async () => {
    await callWithSecret('correct-secret', { commenterId: 'ig-user-1' });

    expect(recordPendingCommentContext).not.toHaveBeenCalled();
  });
});
