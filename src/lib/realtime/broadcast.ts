export async function broadcastEvent(event: { type: string; conversationId?: string }): Promise<void> {
  const url = process.env.REALTIME_INTERNAL_URL;
  if (!url) return;

  try {
    await fetch(`${url}/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-realtime-secret': process.env.REALTIME_SECRET ?? '',
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.warn('Failed to broadcast realtime event', error);
  }
}
