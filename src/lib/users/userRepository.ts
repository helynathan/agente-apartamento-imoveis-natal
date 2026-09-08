import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';

export async function createUser(params: {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'AGENT';
  phone?: string;
}): Promise<{ id: string; email: string; name: string; role: string }> {
  const passwordHash = await hashPassword(params.password);

  return db.user.create({
    data: { email: params.email, passwordHash, name: params.name, role: params.role, phone: params.phone },
    select: { id: true, email: true, name: true, role: true },
  });
}

export async function listUsers(): Promise<
  Array<{ id: string; email: string; name: string; role: string; phone: string | null }>
> {
  return db.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, email: true, name: true, role: true, phone: true },
  });
}

export async function updateUser(
  id: string,
  params: { name: string; email: string; role: 'ADMIN' | 'AGENT'; phone: string | null }
): Promise<{ id: string; email: string; name: string; role: string; phone: string | null }> {
  return db.user.update({
    where: { id },
    data: { name: params.name, email: params.email, role: params.role, phone: params.phone },
    select: { id: true, email: true, name: true, role: true, phone: true },
  });
}
