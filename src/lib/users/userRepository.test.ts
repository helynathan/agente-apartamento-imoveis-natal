import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { createUser, listUsers, updateUser } from '@/lib/users/userRepository';

describe('userRepository', () => {
  afterEach(async () => {
    await db.user.deleteMany();
  });

  it('creates a user with a hashed password, never returning it', async () => {
    const user = await createUser({
      email: 'agente@example.com',
      password: 'minhasenha123',
      name: 'Agente',
      role: 'AGENT',
    });

    expect(user).toEqual({
      id: expect.any(String),
      email: 'agente@example.com',
      name: 'Agente',
      role: 'AGENT',
    });

    const stored = await db.user.findUnique({ where: { email: 'agente@example.com' } });
    expect(stored?.passwordHash).not.toBe('minhasenha123');
  });

  it('stores an optional phone number', async () => {
    const user = await createUser({
      email: 'admin@example.com',
      password: 'minhasenha123',
      name: 'Admin',
      role: 'ADMIN',
      phone: '5511988887777',
    });

    const stored = await db.user.findUnique({ where: { id: user.id } });
    expect(stored?.phone).toBe('5511988887777');
  });

  it('leaves phone null when not provided', async () => {
    const user = await createUser({
      email: 'noph@example.com',
      password: 'minhasenha123',
      name: 'Sem Telefone',
      role: 'AGENT',
    });

    const stored = await db.user.findUnique({ where: { id: user.id } });
    expect(stored?.phone).toBeNull();
  });

  it('lists users ordered by name', async () => {
    await createUser({ email: 'b@example.com', password: 'x', name: 'Beatriz', role: 'AGENT' });
    await createUser({ email: 'a@example.com', password: 'x', name: 'Ana', role: 'AGENT' });

    const users = await listUsers();

    expect(users.map((u) => u.name)).toEqual(['Ana', 'Beatriz']);
  });

  it('includes phone in the listed users', async () => {
    await createUser({
      email: 'admin@example.com',
      password: 'x',
      name: 'Admin',
      role: 'ADMIN',
      phone: '5511988887777',
    });

    const users = await listUsers();

    expect(users[0].phone).toBe('5511988887777');
  });

  it('updates name, email, role and phone', async () => {
    const user = await createUser({
      email: 'old@example.com',
      password: 'x',
      name: 'Nome Antigo',
      role: 'AGENT',
    });

    await updateUser(user.id, {
      name: 'Nome Novo',
      email: 'new@example.com',
      role: 'ADMIN',
      phone: '5511988887777',
    });

    const stored = await db.user.findUnique({ where: { id: user.id } });
    expect(stored?.name).toBe('Nome Novo');
    expect(stored?.email).toBe('new@example.com');
    expect(stored?.role).toBe('ADMIN');
    expect(stored?.phone).toBe('5511988887777');
  });

  it('clears phone when updated with an empty value', async () => {
    const user = await createUser({
      email: 'a@example.com',
      password: 'x',
      name: 'A',
      role: 'AGENT',
      phone: '5511988887777',
    });

    await updateUser(user.id, { name: 'A', email: 'a@example.com', role: 'AGENT', phone: null });

    const stored = await db.user.findUnique({ where: { id: user.id } });
    expect(stored?.phone).toBeNull();
  });
});
