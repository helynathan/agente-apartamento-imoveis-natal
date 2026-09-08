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
vi.mock('@/lib/evolutionApi', () => ({
  fetchProfilePictureUrl: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  db: { conversation: { update: vi.fn().mockResolvedValue(undefined) } },
}));

import { POST } from '@/app/api/webhook/evolution/[secret]/route';
import { persistInboundMessage } from '@/lib/conversations/persistInboundMessage';
import { processInboundForAi } from '@/lib/ai/processInboundForAi';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';
import { fetchProfilePictureUrl } from '@/lib/evolutionApi';
import { db } from '@/lib/db';

function makeRequest(body: unknown, rawBody?: string) {
  return new Request('http://localhost/api/webhook/evolution/correct-secret', {
    method: 'POST',
    body: rawBody ?? JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function callWithSecret(secret: string, body: unknown, rawBody?: string) {
  return POST(makeRequest(body, rawBody), { params: { secret } });
}

const validPayload = {
  event: 'messages.upsert',
  instance: 'test-instance',
  data: {
    key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG123' },
    message: { conversation: 'Olá' },
  },
};

describe('POST /api/webhook/evolution/[secret]', () => {
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
      channel: 'WHATSAPP',
      phone: '5511999999999',
      text: 'Olá',
      externalId: 'MSG123',
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

  it('still returns ok when processInboundForAi rejects', async () => {
    vi.mocked(processInboundForAi).mockRejectedValueOnce(new Error('OpenAI down'));

    const response = await callWithSecret('correct-secret', validPayload);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
  });

  it('ignores the request without processing when the secret does not match', async () => {
    const response = await callWithSecret('wrong-secret', validPayload);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, ignored: true });
    expect(persistInboundMessage).not.toHaveBeenCalled();
  });

  it('returns ok without persisting for irrelevant events', async () => {
    const response = await callWithSecret('correct-secret', { event: 'connection.update' });
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

  it('fetches and stores the profile picture when the conversation is new', async () => {
    vi.mocked(persistInboundMessage).mockResolvedValueOnce({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'AI_HANDLING',
      isNewConversation: true,
    });
    vi.mocked(fetchProfilePictureUrl).mockResolvedValueOnce('https://evo.example.com/pic.jpg');

    await callWithSecret('correct-secret', validPayload);

    expect(fetchProfilePictureUrl).toHaveBeenCalledWith('5511999999999');
    expect(db.conversation.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { profilePictureUrl: 'https://evo.example.com/pic.jpg' },
    });
  });

  it('does not fetch a profile picture when the conversation already existed', async () => {
    vi.mocked(persistInboundMessage).mockResolvedValueOnce({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'AI_HANDLING',
      isNewConversation: false,
    });

    await callWithSecret('correct-secret', validPayload);

    expect(fetchProfilePictureUrl).not.toHaveBeenCalled();
    expect(db.conversation.update).not.toHaveBeenCalled();
  });

  it('still returns ok when fetching the profile picture fails', async () => {
    vi.mocked(persistInboundMessage).mockResolvedValueOnce({
      conversationId: 'c1',
      messageId: 'm1',
      status: 'AI_HANDLING',
      isNewConversation: true,
    });
    vi.mocked(fetchProfilePictureUrl).mockRejectedValueOnce(new Error('Evolution API down'));

    const response = await callWithSecret('correct-secret', validPayload);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(db.conversation.update).not.toHaveBeenCalled();
  });
});
