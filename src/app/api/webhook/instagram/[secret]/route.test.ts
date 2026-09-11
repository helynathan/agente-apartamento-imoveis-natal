import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

vi.mock('@/lib/conversations/persistInboundMessage', () => ({
  persistInboundMessage: vi.fn().mockResolvedValue({ conversationId: 'c1', messageId: 'm1', status: 'AI_HANDLING' }),
}));
vi.mock('@/lib/realtime/broadcast', () => ({
  broadcastEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/ai/processInboundForAi', () => ({
  processInboundForAi: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/queue/enqueueOutboundMessage', () => ({
  enqueueOutboundMessage: vi.fn().mockResolvedValue({ id: 'om1' }),
}));
vi.mock('@/lib/posts/pendingCommentContextRepository', () => ({
  findRecentMediaIdForCommenter: vi.fn().mockResolvedValue(null),
}));

import { POST } from '@/app/api/webhook/instagram/[secret]/route';
import { persistInboundMessage } from '@/lib/conversations/persistInboundMessage';
import { processInboundForAi } from '@/lib/ai/processInboundForAi';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';
import { findRecentMediaIdForCommenter } from '@/lib/posts/pendingCommentContextRepository';

function makeRequest(body: unknown, rawBody?: string) {
  return new Request('http://localhost/api/webhook/instagram/correct-secret', {
    method: 'POST',
    body: rawBody ?? JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function callWithSecret(secret: string, body: unknown, rawBody?: string) {
  return POST(makeRequest(body, rawBody), { params: { secret } });
}

const validPayload = { senderId: 'ig-user-1', messageId: 'IGM123', content: 'Olá' };

describe('POST /api/webhook/instagram/[secret]', () => {
  beforeEach(() => {
    vi.stubEnv('WEBHOOK_SECRET', 'correct-secret');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('persists a valid inbound message and returns ok when the secret matches', async () => {
    const response = await callWithSecret('correct-secret', validPayload);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(persistInboundMessage).toHaveBeenCalledWith({
      channel: 'INSTAGRAM',
      phone: 'ig-user-1',
      text: 'Olá',
      externalId: 'IGM123',
      name: undefined,
    });
  });

  it('calls processInboundForAi when the conversation is AI_HANDLING', async () => {
    await callWithSecret('correct-secret', validPayload);

    expect(processInboundForAi).toHaveBeenCalledWith('c1');
  });

  it('does not call processInboundForAi when the conversation is not AI_HANDLING', async () => {
    vi.mocked(persistInboundMessage).mockResolvedValueOnce({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'ASSIGNED',
      isNewConversation: false,
    });

    await callWithSecret('correct-secret', validPayload);

    expect(processInboundForAi).not.toHaveBeenCalled();
  });

  it('ignores the request without processing when the secret does not match', async () => {
    const response = await callWithSecret('wrong-secret', validPayload);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, ignored: true });
    expect(persistInboundMessage).not.toHaveBeenCalled();
  });

  it('returns ok without persisting for a payload missing required fields', async () => {
    const response = await callWithSecret('correct-secret', { senderId: 'ig-user-1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, ignored: true });
    expect(persistInboundMessage).not.toHaveBeenCalled();
  });

  it('enqueues the reopen prompt and does not call the AI when needsReopenPrompt is true', async () => {
    vi.mocked(persistInboundMessage).mockResolvedValueOnce({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'QUEUED',
      needsReopenPrompt: true,
      isNewConversation: false,
    });

    await callWithSecret('correct-secret', validPayload);

    expect(enqueueOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'c1' })
    );
    expect(processInboundForAi).not.toHaveBeenCalled();
  });

  it('discards a malformed (non-JSON) body instead of crashing', async () => {
    const response = await callWithSecret('correct-secret', undefined, 'not json');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, ignored: true });
    expect(persistInboundMessage).not.toHaveBeenCalled();
  });

  it('passes profilePictureUrl through to persistInboundMessage when present', async () => {
    await callWithSecret('correct-secret', {
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Olá',
      profilePictureUrl: 'https://scontent.cdninstagram.com/pic.jpg',
    });

    expect(persistInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ profilePictureUrl: 'https://scontent.cdninstagram.com/pic.jpg' })
    );
  });

  it('passes originMediaId through to persistInboundMessage when a pending comment context matches', async () => {
    vi.mocked(findRecentMediaIdForCommenter).mockResolvedValueOnce('media-abc');

    await callWithSecret('correct-secret', {
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Olá',
    });

    expect(findRecentMediaIdForCommenter).toHaveBeenCalledWith('ig-user-1');
    expect(persistInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ originMediaId: 'media-abc' })
    );
  });
});
