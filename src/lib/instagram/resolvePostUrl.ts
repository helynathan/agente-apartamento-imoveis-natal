export async function resolvePostUrl(postUrl: string): Promise<{ mediaId: string }> {
  const url = process.env.N8N_RESOLVE_POST_URL_WEBHOOK_URL;
  if (!url) {
    throw new Error('N8N_RESOLVE_POST_URL_WEBHOOK_URL is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postUrl }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`N8N resolve-post-url webhook responded with HTTP ${response.status}`);
  }

  const data = (await response.json()) as { mediaId?: unknown };
  if (typeof data.mediaId !== 'string' || data.mediaId.length === 0) {
    throw new Error('N8N resolve-post-url webhook did not return a mediaId');
  }

  return { mediaId: data.mediaId };
}
