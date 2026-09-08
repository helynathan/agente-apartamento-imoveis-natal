import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/ai/requestEmbedding', () => ({
  requestEmbedding: vi.fn(),
}));

import { requestEmbedding } from '@/lib/ai/requestEmbedding';
import { searchRelevantProducts } from '@/lib/products/searchRelevantProducts';

// The embedding column is vector(1536), so pgvector enforces the exact
// dimensionality on insert/update — a shorter vector is rejected with
// "expected 1536 dimensions, not N" (see src/lib/db.product-schema.test.ts).
// We build full 1536-dim vectors here, varying only the first two values,
// purely to distinguish "similar to the query" from "different" by cosine
// distance.
function buildVector(...leadingValues: number[]): number[] {
  const values = new Array(1536).fill(0);
  leadingValues.forEach((value, index) => {
    values[index] = value;
  });
  return values;
}

async function insertProductPage(codigo: string, url: string, content: string, embedding: number[]) {
  const page = await db.productPage.create({ data: { codigo, url, content } });
  const vectorLiteral = `[${embedding.join(',')}]`;
  await db.$executeRaw`UPDATE "ProductPage" SET embedding = ${vectorLiteral}::vector WHERE id = ${page.id}`;
}

describe('searchRelevantProducts', () => {
  afterEach(async () => {
    vi.mocked(requestEmbedding).mockReset();
    await db.productPage.deleteMany();
  });

  it('returns the most similar products first, limited to the given count', async () => {
    await insertProductPage('produto-perto', 'https://example.com/perto', 'Produto perto', buildVector(1, 0));
    await insertProductPage('produto-longe', 'https://example.com/longe', 'Produto longe', buildVector(0, 1));
    vi.mocked(requestEmbedding).mockResolvedValue(buildVector(1, 0));

    const results = await searchRelevantProducts('pergunta do cliente', 1);

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe('https://example.com/perto');
  });

  it('excludes product pages without an embedding yet', async () => {
    await db.productPage.create({
      data: { codigo: 'produto-sem-embedding', url: 'https://example.com/sem-embedding' },
    });
    vi.mocked(requestEmbedding).mockResolvedValue(buildVector(1, 0));

    const results = await searchRelevantProducts('pergunta', 5);

    expect(results).toHaveLength(0);
  });
});
