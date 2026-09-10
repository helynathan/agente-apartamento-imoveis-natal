import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import {
  upsertPostListing,
  listPostListings,
  findPostListingByMediaId,
  deletePostListing,
} from '@/lib/posts/postListingRepository';

describe('postListingRepository', () => {
  afterEach(async () => {
    await db.postListing.deleteMany();
  });

  it('creates a new listing on first upsert', async () => {
    const listing = await upsertPostListing({
      mediaId: 'media-1',
      postUrl: 'https://www.instagram.com/p/ABC123/',
      propertyText: 'Apartamento 2 quartos, 80m²',
    });

    expect(listing.mediaId).toBe('media-1');
    expect(listing.propertyText).toBe('Apartamento 2 quartos, 80m²');
  });

  it('updates propertyText on a second upsert with the same mediaId', async () => {
    await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto original' });

    const updated = await upsertPostListing({
      mediaId: 'media-1',
      postUrl: 'https://www.instagram.com/p/ABC123/',
      propertyText: 'Texto corrigido',
    });

    expect(updated.propertyText).toBe('Texto corrigido');
    const all = await listPostListings();
    expect(all).toHaveLength(1);
  });

  it('finds a listing by mediaId', async () => {
    await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto' });

    const found = await findPostListingByMediaId('media-1');
    const notFound = await findPostListingByMediaId('media-inexistente');

    expect(found?.propertyText).toBe('Texto');
    expect(notFound).toBeNull();
  });

  it('lists all listings ordered by most recently created first', async () => {
    await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/A/', propertyText: 'A' });
    await upsertPostListing({ mediaId: 'media-2', postUrl: 'https://www.instagram.com/p/B/', propertyText: 'B' });

    const all = await listPostListings();

    expect(all.map((l) => l.mediaId)).toEqual(['media-2', 'media-1']);
  });

  it('deletes a listing by id', async () => {
    const listing = await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto' });

    await deletePostListing(listing.id);

    const found = await findPostListingByMediaId('media-1');
    expect(found).toBeNull();
  });
});
