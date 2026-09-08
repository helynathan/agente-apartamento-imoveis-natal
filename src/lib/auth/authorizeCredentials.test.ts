import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { authorizeCredentials } from '@/lib/auth/authorizeCredentials';

describe('authorizeCredentials', () => {
  afterEach(async () => {
    await db.user.deleteMany();
  });

  it('returns the user when email and password match', async () => {
    const passwordHash = await hashPassword('minhasenha123');
    const user = await db.user.create({
      data: { email: 'agente@example.com', passwordHash, name: 'Agente', role: 'AGENT' },
    });

    const result = await authorizeCredentials('agente@example.com', 'minhasenha123');

    expect(result).toEqual({
      id: user.id,
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT',
    });
  });

  it('returns null for a wrong password', async () => {
    const passwordHash = await hashPassword('minhasenha123');
    await db.user.create({
      data: { email: 'agente@example.com', passwordHash, name: 'Agente' },
    });

    expect(await authorizeCredentials('agente@example.com', 'senhaerrada')).toBeNull();
  });

  it('returns null for an unknown email', async () => {
    expect(await authorizeCredentials('naoexiste@example.com', 'qualquer')).toBeNull();
  });

  it('returns null when email or password is missing', async () => {
    expect(await authorizeCredentials(undefined, 'qualquer')).toBeNull();
    expect(await authorizeCredentials('agente@example.com', undefined)).toBeNull();
  });
});
