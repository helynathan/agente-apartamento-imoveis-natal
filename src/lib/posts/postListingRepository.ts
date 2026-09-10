import { db } from '@/lib/db';

export interface PostListing {
  id: string;
  mediaId: string;
  postUrl: string;
  propertyText: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function upsertPostListing(params: {
  mediaId: string;
  postUrl: string;
  propertyText: string;
}): Promise<PostListing> {
  return db.postListing.upsert({
    where: { mediaId: params.mediaId },
    update: { postUrl: params.postUrl, propertyText: params.propertyText },
    create: { mediaId: params.mediaId, postUrl: params.postUrl, propertyText: params.propertyText },
  });
}

export async function listPostListings(): Promise<PostListing[]> {
  return db.postListing.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function findPostListingByMediaId(mediaId: string): Promise<PostListing | null> {
  return db.postListing.findUnique({ where: { mediaId } });
}

export async function deletePostListing(id: string): Promise<void> {
  await db.postListing.delete({ where: { id } });
}
