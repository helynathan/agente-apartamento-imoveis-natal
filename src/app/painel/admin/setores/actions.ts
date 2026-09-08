'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { createSector } from '@/lib/sectors/sectorRepository';
import { revalidatePath } from 'next/cache';

export async function createSectorAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem criar setores.');
  }

  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    throw new Error('Nome do setor é obrigatório.');
  }

  await createSector(name);
  revalidatePath('/painel/admin/setores');
}
