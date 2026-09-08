import OpenAI from 'openai';

export async function requestEmbedding(text: string): Promise<number[]> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15_000,
    maxRetries: 1,
  });

  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('OpenAI embeddings response has no data');
  }

  return embedding;
}
