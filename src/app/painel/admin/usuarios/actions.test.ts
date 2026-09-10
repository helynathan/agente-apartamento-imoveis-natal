import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { createUserAction, updateUserAction, updatePasswordAction } from './actions';

function formDataFrom(entries: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe('createUserAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.user.deleteMany();
  });

  it('rejects an invalid phone number', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);

    const formData = formDataFrom({
      name: 'Novo',
      email: 'novo@example.com',
      password: 'minhasenha123',
      role: 'AGENT',
      phone: '+55 11 98888-7777',
    });

    await expect(createUserAction(formData)).rejects.toThrow('Telefone inválido.');

    const created = await db.user.findUnique({ where: { email: 'novo@example.com' } });
    expect(created).toBeNull();
  });

  it('accepts a valid phone number', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);

    const formData = formDataFrom({
      name: 'Novo',
      email: 'novo@example.com',
      password: 'minhasenha123',
      role: 'AGENT',
      phone: '5511988887777',
    });

    await createUserAction(formData);

    const created = await db.user.findUnique({ where: { email: 'novo@example.com' } });
    expect(created?.phone).toBe('5511988887777');
  });

  it('accepts an empty phone (optional field)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);

    const formData = formDataFrom({
      name: 'Novo',
      email: 'novo@example.com',
      password: 'minhasenha123',
      role: 'AGENT',
      phone: '',
    });

    await createUserAction(formData);

    const created = await db.user.findUnique({ where: { email: 'novo@example.com' } });
    expect(created?.phone).toBeNull();
  });
});

describe('updateUserAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.user.deleteMany();
  });

  it('rejects an invalid phone number', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A', role: 'AGENT' },
    });

    const formData = formDataFrom({
      id: user.id,
      name: 'A',
      email: 'a@example.com',
      role: 'AGENT',
      phone: '(11) 98888-7777',
    });

    await expect(updateUserAction(formData)).rejects.toThrow('Telefone inválido.');

    const untouched = await db.user.findUnique({ where: { id: user.id } });
    expect(untouched?.phone).toBeNull();
  });

  it('updates name, email, role and phone when the caller is an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const user = await db.user.create({
      data: { email: 'old@example.com', passwordHash: 'x', name: 'Nome Antigo', role: 'AGENT' },
    });

    const formData = formDataFrom({
      id: user.id,
      name: 'Nome Novo',
      email: 'new@example.com',
      role: 'ADMIN',
      phone: '5511988887777',
    });

    await updateUserAction(formData);

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated?.name).toBe('Nome Novo');
    expect(updated?.email).toBe('new@example.com');
    expect(updated?.role).toBe('ADMIN');
    expect(updated?.phone).toBe('5511988887777');
  });

  it('clears the phone when the field is submitted empty', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const user = await db.user.create({
      data: {
        email: 'a@example.com',
        passwordHash: 'x',
        name: 'A',
        role: 'AGENT',
        phone: '5511988887777',
      },
    });

    const formData = formDataFrom({ id: user.id, name: 'A', email: 'a@example.com', role: 'AGENT', phone: '' });

    await updateUserAction(formData);

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated?.phone).toBeNull();
  });

  it('rejects the update when the caller is not an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'AGENT' } } as never);
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A', role: 'AGENT' },
    });

    const formData = formDataFrom({ id: user.id, name: 'B', email: 'a@example.com', role: 'AGENT', phone: '' });

    await expect(updateUserAction(formData)).rejects.toThrow(
      'Apenas administradores podem editar usuários.',
    );

    const untouched = await db.user.findUnique({ where: { id: user.id } });
    expect(untouched?.name).toBe('A');
  });

  it('rejects when name or email is missing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'x', name: 'A', role: 'AGENT' },
    });

    const formData = formDataFrom({ id: user.id, name: '', email: 'a@example.com', role: 'AGENT', phone: '' });

    await expect(updateUserAction(formData)).rejects.toThrow('Nome e email são obrigatórios.');
  });
});

describe('updatePasswordAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.user.deleteMany();
  });

  it('changes the password hash when the caller is an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'hash-antigo', name: 'A', role: 'AGENT' },
    });

    const formData = formDataFrom({ id: user.id, password: 'senhanova123' });

    await updatePasswordAction(formData);

    const updated = await db.user.findUnique({ where: { id: user.id } });
    expect(updated?.passwordHash).not.toBe('hash-antigo');
    expect(updated?.passwordHash).not.toBe('senhanova123');
  });

  it('rejects when the caller is not an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'AGENT' } } as never);
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'hash-antigo', name: 'A', role: 'AGENT' },
    });

    const formData = formDataFrom({ id: user.id, password: 'senhanova123' });

    await expect(updatePasswordAction(formData)).rejects.toThrow(
      'Apenas administradores podem alterar senhas.',
    );

    const untouched = await db.user.findUnique({ where: { id: user.id } });
    expect(untouched?.passwordHash).toBe('hash-antigo');
  });

  it('rejects an empty password', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const user = await db.user.create({
      data: { email: 'a@example.com', passwordHash: 'hash-antigo', name: 'A', role: 'AGENT' },
    });

    const formData = formDataFrom({ id: user.id, password: '' });

    await expect(updatePasswordAction(formData)).rejects.toThrow('Senha é obrigatória.');

    const untouched = await db.user.findUnique({ where: { id: user.id } });
    expect(untouched?.passwordHash).toBe('hash-antigo');
  });
});
