// src/lib/db.post-listing-schema.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';

describe('PostListing schema', () => {
  afterEach(async () => {
    await db.postListing.deleteMany();
  });

  it('creates a post listing with default empty propertyText', async () => {
    const listing = await db.postListing.create({
      data: { mediaId: '17841409145832360_123', postUrl: 'https://www.instagram.com/p/ABC123/' },
    });

    expect(listing.propertyText).toBe('');
    expect(listing.mediaId).toBe('17841409145832360_123');
  });

  it('enforces a unique mediaId', async () => {
    await db.postListing.create({
      data: { mediaId: 'dup-media-id', postUrl: 'https://www.instagram.com/p/ABC123/' },
    });

    await expect(
      db.postListing.create({ data: { mediaId: 'dup-media-id', postUrl: 'https://www.instagram.com/p/DIFFERENT/' } })
    ).rejects.toThrow();
  });

  it('allows a conversation to reference a mediaId via originMediaId', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: 'ig-user-1', channel: 'INSTAGRAM', originMediaId: '17841409145832360_123' },
    });

    expect(conversation.originMediaId).toBe('17841409145832360_123');
    await db.conversation.deleteMany();
  });
});
