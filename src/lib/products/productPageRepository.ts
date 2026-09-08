import { db } from '@/lib/db';

export interface ProductSyncStatus {
  totalImoveis: number;
  lastSyncedAt: Date | null;
  errorCount: number;
}

export async function getProductSyncStatus(): Promise<ProductSyncStatus> {
  const [totalImoveis, errorCount, mostRecentlySynced] = await Promise.all([
    db.productPage.count(),
    db.productPage.count({ where: { lastError: { not: null } } }),
    db.productPage.findFirst({
      where: { lastCrawledAt: { not: null } },
      orderBy: { lastCrawledAt: 'desc' },
      select: { lastCrawledAt: true },
    }),
  ]);

  return {
    totalImoveis,
    lastSyncedAt: mostRecentlySynced?.lastCrawledAt ?? null,
    errorCount,
  };
}
