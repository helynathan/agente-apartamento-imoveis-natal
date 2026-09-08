import { describe, it, expect } from 'vitest';
import { parseInboundWebhook } from '@/lib/webhook/parseInboundWebhook';

const basePayload = {
  event: 'messages.upsert',
  instance: 'test-instance',
  data: {
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: false,
      id: 'MSG123',
    },
    message: { conversation: 'Olá, preciso de ajuda' },
    pushName: 'Cliente Teste',
  },
};

describe('parseInboundWebhook', () => {
  it('extracts phone, text, externalId and name from a valid inbound message', () => {
    const result = parseInboundWebhook(basePayload);

    expect(result).toEqual({
      phone: '5511999999999',
      text: 'Olá, preciso de ajuda',
      externalId: 'MSG123',
      name: 'Cliente Teste',
    });
  });

  it('omits name when pushName is missing from the payload', () => {
    const payload = {
      ...basePayload,
      data: { key: basePayload.data.key, message: basePayload.data.message },
    };

    const result = parseInboundWebhook(payload);

    expect(result?.name).toBeUndefined();
  });

  it('returns null for messages sent by the instance itself (fromMe)', () => {
    const payload = {
      ...basePayload,
      data: { ...basePayload.data, key: { ...basePayload.data.key, fromMe: true } },
    };

    expect(parseInboundWebhook(payload)).toBeNull();
  });

  it('returns null for events other than messages.upsert', () => {
    const payload = { ...basePayload, event: 'connection.update' };

    expect(parseInboundWebhook(payload)).toBeNull();
  });

  it('returns null when the message has no text content', () => {
    const payload = { ...basePayload, data: { ...basePayload.data, message: {} } };

    expect(parseInboundWebhook(payload)).toBeNull();
  });

  it('returns null for malformed payloads', () => {
    expect(parseInboundWebhook({ foo: 'bar' })).toBeNull();
    expect(parseInboundWebhook(null)).toBeNull();
  });
});
