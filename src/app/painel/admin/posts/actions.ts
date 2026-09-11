'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { revalidatePath } from 'next/cache';
import { resolvePostUrl } from '@/lib/instagram/resolvePostUrl';
import { extractPdfText } from '@/lib/pdf/extractPdfText';
import { upsertPostListing, deletePostListing } from '@/lib/posts/postListingRepository';

const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

export async function createPostListingAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem vincular PDFs a posts.');
  }

  const postUrl = String(formData.get('postUrl') ?? '').trim();
  const file = formData.get('pdf');

  if (!postUrl) {
    throw new Error('Link do post é obrigatório.');
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Selecione um arquivo PDF.');
  }
  if (file.type !== 'application/pdf') {
    throw new Error('O arquivo precisa ser um PDF.');
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('O PDF não pode passar de 20MB.');
  }

  const { mediaId } = await resolvePostUrl(postUrl);

  const buffer = Buffer.from(await file.arrayBuffer());
  const propertyText = await extractPdfText(buffer);

  await upsertPostListing({ mediaId, postUrl, propertyText });
  revalidatePath('/painel/admin/posts');
}

export async function updatePostListingTextAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem editar o texto do imóvel.');
  }

  const mediaId = String(formData.get('mediaId') ?? '');
  const postUrl = String(formData.get('postUrl') ?? '');
  const propertyText = String(formData.get('propertyText') ?? '').trim();

  if (!propertyText) {
    throw new Error('Texto do imóvel é obrigatório.');
  }

  await upsertPostListing({ mediaId, postUrl, propertyText });
  revalidatePath('/painel/admin/posts');
}

export async function deletePostListingAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem remover vínculos.');
  }

  const id = String(formData.get('id') ?? '');
  await deletePostListing(id);
  revalidatePath('/painel/admin/posts');
}
