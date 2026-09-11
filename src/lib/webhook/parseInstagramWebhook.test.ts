import { describe, it, expect } from 'vitest';
import { parseInstagramWebhook } from '@/lib/webhook/parseInstagramWebhook';

describe('parseInstagramWebhook', () => {
  it('parses a valid payload', () => {
    const result = parseInstagramWebhook({
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Olá, tem esse imóvel disponível?',
      customerName: 'Cliente Instagram',
    });

    expect(result).toEqual({
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      text: 'Olá, tem esse imóvel disponível?',
      name: 'Cliente Instagram',
    });
  });

  it('parses a valid payload without customerName', () => {
    const result = parseInstagramWebhook({
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Oi',
    });

    expect(result).toEqual({
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      text: 'Oi',
      name: undefined,
    });
  });

  it('returns null when senderId is missing', () => {
    expect(parseInstagramWebhook({ messageId: 'IGM123', content: 'Oi' })).toBeNull();
  });

  it('returns null when messageId is missing', () => {
    expect(parseInstagramWebhook({ senderId: 'ig-user-1', content: 'Oi' })).toBeNull();
  });

  it('returns null when content is missing or empty', () => {
    expect(parseInstagramWebhook({ senderId: 'ig-user-1', messageId: 'IGM123', content: '' })).toBeNull();
    expect(parseInstagramWebhook({ senderId: 'ig-user-1', messageId: 'IGM123' })).toBeNull();
  });

  it('returns null for a non-object payload', () => {
    expect(parseInstagramWebhook(null)).toBeNull();
    expect(parseInstagramWebhook('not an object')).toBeNull();
  });

  it('parses profilePictureUrl when present', () => {
    const result = parseInstagramWebhook({
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Oi',
      profilePictureUrl: 'https://scontent.cdninstagram.com/pic.jpg',
    });

    expect(result?.profilePictureUrl).toBe('https://scontent.cdninstagram.com/pic.jpg');
  });

  it('omits profilePictureUrl when absent', () => {
    const result = parseInstagramWebhook({ senderId: 'ig-user-1', messageId: 'IGM123', content: 'Oi' });

    expect(result?.profilePictureUrl).toBeUndefined();
  });

});
