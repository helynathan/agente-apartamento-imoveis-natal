import { describe, it, expect } from 'vitest';
import { formatWaitingTime } from '@/lib/conversations/formatWaitingTime';

describe('formatWaitingTime', () => {
  const now = new Date('2026-08-22T12:00:00Z');

  it('returns "agora mesmo" for less than a minute', () => {
    expect(formatWaitingTime(new Date('2026-08-22T11:59:30Z'), now)).toBe('agora mesmo');
  });

  it('returns minutes for less than an hour', () => {
    expect(formatWaitingTime(new Date('2026-08-22T11:48:00Z'), now)).toBe('há 12 min');
  });

  it('returns hours for less than a day', () => {
    expect(formatWaitingTime(new Date('2026-08-22T09:00:00Z'), now)).toBe('há 3h');
  });

  it('returns days, pluralized correctly', () => {
    expect(formatWaitingTime(new Date('2026-08-20T12:00:00Z'), now)).toBe('há 2 dias');
    expect(formatWaitingTime(new Date('2026-08-21T12:00:00Z'), now)).toBe('há 1 dia');
  });
});
