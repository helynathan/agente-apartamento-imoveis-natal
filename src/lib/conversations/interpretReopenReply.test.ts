import { describe, it, expect } from 'vitest';
import { interpretReopenReply } from '@/lib/conversations/interpretReopenReply';

describe('interpretReopenReply', () => {
  it('returns novo_assunto for "2"', () => {
    expect(interpretReopenReply('2')).toBe('novo_assunto');
  });

  it('returns novo_assunto for "novo assunto", case-insensitive', () => {
    expect(interpretReopenReply('Novo Assunto')).toBe('novo_assunto');
  });

  it('returns novo_assunto for "outro"', () => {
    expect(interpretReopenReply('outro')).toBe('novo_assunto');
  });

  it('returns continuar for "1"', () => {
    expect(interpretReopenReply('1')).toBe('continuar');
  });

  it('returns continuar for ambiguous free text', () => {
    expect(interpretReopenReply('oi tudo bem?')).toBe('continuar');
  });

  it('returns continuar for empty text', () => {
    expect(interpretReopenReply('')).toBe('continuar');
  });
});
