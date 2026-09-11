interface ParsedInstagramMessage {
  senderId: string;
  messageId: string;
  text: string;
  name?: string;
  profilePictureUrl?: string;
}

export function parseInstagramWebhook(payload: unknown): ParsedInstagramMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;

  const senderId = body.senderId;
  const messageId = body.messageId;
  const text = body.content;
  const name = body.customerName;
  const profilePictureUrl = body.profilePictureUrl;

  if (typeof senderId !== 'string' || senderId.length === 0) return null;
  if (typeof messageId !== 'string' || messageId.length === 0) return null;
  if (typeof text !== 'string' || text.length === 0) return null;

  return {
    senderId,
    messageId,
    text,
    name: typeof name === 'string' && name.length > 0 ? name : undefined,
    profilePictureUrl: typeof profilePictureUrl === 'string' && profilePictureUrl.length > 0 ? profilePictureUrl : undefined,
  };
}
