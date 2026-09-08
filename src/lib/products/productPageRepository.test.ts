import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { getProductSyncStatus } from '@/lib/products/productPageRepository';

describe('getProductSyncStatus', () => {
  afterEach(async () => {
    await db.productPage.deleteMany();
  });

  it('returns zeroed status when there are no product pages', async () => {
    const status = await getProductSyncStatus();
    expect(status).toEqual({ totalImoveis: 0, lastSyncedAt: null, errorCount: 0 });
  });

  it('counts total pages, errors, and the most recent sync', async () => {
    const older = new Date('2026-08-20T10:00:00Z');
    const newer = new Date('2026-08-26T10:00:00Z');
    await db.productPage.create({
      data: { codigo: '1', url: 'https://example.com/1', lastCrawledAt: older },
    });
    await db.productPage.create({
      data: { codigo: '2', url: 'https://example.com/2', lastCrawledAt: newer },
    });
    await db.productPage.create({
      data: { codigo: '3', url: 'pending:3', lastError: 'Link não gerado para este imóvel' },
    });

    const status = await getProductSyncStatus();

    expect(status.totalImoveis).toBe(3);
    expect(status.errorCount).toBe(1);
    expect(status.lastSyncedAt).toEqual(newer);
  });
});
