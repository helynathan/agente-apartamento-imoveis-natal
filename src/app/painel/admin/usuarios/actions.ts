'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { createUser, updateUser } from '@/lib/users/userRepository';
import { isValidPhone } from '@/lib/users/isValidPhone';
import { revalidatePath } from 'next/cache';

export async function createUserAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem criar usuários.');
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const role = formData.get('role') === 'ADMIN' ? 'ADMIN' : 'AGENT';

  if (!email || !password || !name) {
    throw new Error('Email, senha e nome são obrigatórios.');
  }
  if (phone && !isValidPhone(phone)) {
    throw new Error('Telefone inválido.');
  }

  await createUser({ email, password, name, role, phone: phone || undefined });
  revalidatePath('/painel/admin/usuarios');
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem editar usuários.');
  }

  const id = String(formData.get('id'));
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const role = formData.get('role') === 'ADMIN' ? 'ADMIN' : 'AGENT';

  if (!name || !email) {
    throw new Error('Nome e email são obrigatórios.');
  }
  if (phone && !isValidPhone(phone)) {
    throw new Error('Telefone inválido.');
  }

  await updateUser(id, { name, email, role, phone: phone || null });
  revalidatePath('/painel/admin/usuarios');
}
