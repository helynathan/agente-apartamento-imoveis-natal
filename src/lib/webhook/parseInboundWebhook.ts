interface ParsedInboundMessage {
  phone: string;
  text: string;
  externalId: string;
  name?: string;
}

export function parseInboundWebhook(payload: unknown): ParsedInboundMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;

  if (body.event !== 'messages.upsert') return null;

  const data = body.data as Record<string, unknown> | undefined;
  if (!data) return null;

  const key = data.key as Record<string, unknown> | undefined;
  if (!key || key.fromMe !== false) return null;

  const remoteJid = key.remoteJid;
  const externalId = key.id;
  if (typeof remoteJid !== 'string' || typeof externalId !== 'string') return null;

  const message = data.message as Record<string, unknown> | undefined;
  const text = message?.conversation;
  if (typeof text !== 'string' || text.length === 0) return null;

  const phone = remoteJid.split('@')[0];
  const pushName = data.pushName;
  const name = typeof pushName === 'string' && pushName.length > 0 ? pushName : undefined;

  return { phone, text, externalId, name };
}
