import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/instagram/resolvePostUrl', () => ({ resolvePostUrl: vi.fn() }));
vi.mock('@/lib/pdf/extractPdfText', () => ({ extractPdfText: vi.fn() }));

import { getServerSession } from 'next-auth';
import { resolvePostUrl } from '@/lib/instagram/resolvePostUrl';
import { extractPdfText } from '@/lib/pdf/extractPdfText';
import { createPostListingAction, updatePostListingTextAction, deletePostListingAction } from './actions';

function formDataWithFile(entries: Record<string, string>, file?: { name: string; type: string; content: string }): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  if (file) {
    formData.set('pdf', new File([file.content], file.name, { type: file.type }));
  }
  return formData;
}

describe('createPostListingAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.postListing.deleteMany();
  });

  it('resolves the post URL, extracts the PDF text and saves a listing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    vi.mocked(resolvePostUrl).mockResolvedValue({ mediaId: 'media-abc' });
    vi.mocked(extractPdfText).mockResolvedValue('Apartamento 2 quartos');

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'ficha.pdf', type: 'application/pdf', content: 'conteudo-fake' }
    );

    await createPostListingAction(formData);

    const listing = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(listing?.propertyText).toBe('Apartamento 2 quartos');
    expect(listing?.postUrl).toBe('https://www.instagram.com/p/ABC123/');
  });

  it('saves the listing with empty propertyText when extraction fails, without throwing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    vi.mocked(resolvePostUrl).mockResolvedValue({ mediaId: 'media-abc' });
    vi.mocked(extractPdfText).mockResolvedValue('');

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'ficha.pdf', type: 'application/pdf', content: 'conteudo-fake' }
    );

    await createPostListingAction(formData);

    const listing = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(listing?.propertyText).toBe('');
  });

  it('rejects a non-PDF file', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'foto.png', type: 'image/png', content: 'conteudo-fake' }
    );

    await expect(createPostListingAction(formData)).rejects.toThrow('O arquivo precisa ser um PDF.');
    expect(resolvePostUrl).not.toHaveBeenCalled();
  });

  it('rejects when the caller is not an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'AGENT' } } as never);

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'ficha.pdf', type: 'application/pdf', content: 'conteudo-fake' }
    );

    await expect(createPostListingAction(formData)).rejects.toThrow(
      'Apenas administradores podem vincular PDFs a posts.'
    );
    expect(resolvePostUrl).not.toHaveBeenCalled();
  });
});

describe('updatePostListingTextAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.postListing.deleteMany();
  });

  it('updates the propertyText of an existing listing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    await db.postListing.create({ data: { mediaId: 'media-abc', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto antigo' } });

    const formData = new FormData();
    formData.set('mediaId', 'media-abc');
    formData.set('postUrl', 'https://www.instagram.com/p/ABC123/');
    formData.set('propertyText', 'Texto corrigido pelo admin');

    await updatePostListingTextAction(formData);

    const listing = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(listing?.propertyText).toBe('Texto corrigido pelo admin');
  });
});

describe('deletePostListingAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.postListing.deleteMany();
  });

  it('deletes the listing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const listing = await db.postListing.create({ data: { mediaId: 'media-abc', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto' } });

    const formData = new FormData();
    formData.set('id', listing.id);

    await deletePostListingAction(formData);

    const found = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(found).toBeNull();
  });
});
