export async function sendInstagramMessage(params: { externalId: string; text: string }): Promise<{ id: string }> {
  const url = process.env.N8N_INSTAGRAM_SEND_WEBHOOK_URL;
  if (!url) {
    throw new Error('N8N_INSTAGRAM_SEND_WEBHOOK_URL is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId: params.externalId, content: params.text }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`N8N Instagram send webhook responded with HTTP ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  const id = (data as { id?: unknown })?.id;
  return { id: typeof id === 'string' ? id : '' };
}
