import { db } from '@/lib/db';
import { requestEmbedding } from '@/lib/ai/requestEmbedding';

export interface RelevantProduct {
  url: string;
  content: string;
}

export async function searchRelevantProducts(query: string, limit: number): Promise<RelevantProduct[]> {
  const embedding = await requestEmbedding(query);
  const vectorLiteral = `[${embedding.join(',')}]`;

  return db.$queryRaw<RelevantProduct[]>`
    SELECT url, content
    FROM "ProductPage"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;
}
