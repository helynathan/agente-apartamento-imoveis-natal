// src/lib/db.product-schema.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';

describe('ProductPage schema', () => {
  afterEach(async () => {
    await db.productPage.deleteMany();
  });

  it('creates a product page with default content and no embedding', async () => {
    const page = await db.productPage.create({
      data: { codigo: 'produto-x', url: 'https://example.com/produto-x' },
    });

    expect(page.url).toBe('https://example.com/produto-x');
    expect(page.content).toBe('');
    expect(page.lastCrawledAt).toBeNull();
  });

  it('allows setting the embedding via raw SQL', async () => {
    const page = await db.productPage.create({
      data: { codigo: 'produto-y', url: 'https://example.com/produto-y' },
    });

    // The embedding column is vector(1536), so pgvector enforces the exact
    // dimensionality on insert/update — a shorter vector is rejected with
    // "expected 1536 dimensions, not N". We build a full 1536-dim vector here
    // (only the first three values are non-zero) purely to validate that the
    // column round-trips values via raw SQL; real embeddings arrive in later tasks.
    const values = new Array(1536).fill(0);
    values[0] = 0.1;
    values[1] = 0.2;
    values[2] = 0.3;
    const vectorLiteral = `[${values.join(',')}]`;

    await db.$executeRaw`UPDATE "ProductPage" SET embedding = ${vectorLiteral}::vector WHERE id = ${page.id}`;

    const raw = await db.$queryRaw<Array<{ embedding: string }>>`
      SELECT embedding::text as embedding FROM "ProductPage" WHERE id = ${page.id}
    `;
    expect(raw[0].embedding).toBe(vectorLiteral);
  });
});
