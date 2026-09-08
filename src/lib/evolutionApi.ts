export async function sendText(params: { phone: string; text: string }): Promise<{ id: string }> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    throw new Error('Evolution API environment variables are not configured');
  }

  const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: params.phone,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Evolution API error (${response.status}): ${body}`);
  }

  const data = (await response.json()) as unknown;
  const id = (data as { key?: { id?: unknown } })?.key?.id;
  return { id: typeof id === 'string' ? id : '' };
}

export async function fetchProfilePictureUrl(phone: string): Promise<string | null> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    throw new Error('Evolution API environment variables are not configured');
  }

  const response = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instance}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({ number: phone }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as unknown;
  const url = (data as { profilePictureUrl?: unknown })?.profilePictureUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}
