import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('hashes a password to a different string', async () => {
    const hash = await hashPassword('minhasenha123');
    expect(hash).not.toBe('minhasenha123');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('verifies the correct password against its hash', async () => {
    const hash = await hashPassword('minhasenha123');
    expect(await verifyPassword('minhasenha123', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('minhasenha123');
    expect(await verifyPassword('senhaerrada', hash)).toBe(false);
  });
});
