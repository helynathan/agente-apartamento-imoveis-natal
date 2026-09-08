import { parseInstagramWebhook } from '@/lib/webhook/parseInstagramWebhook';
import { persistInboundMessage } from '@/lib/conversations/persistInboundMessage';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { processInboundForAi } from '@/lib/ai/processInboundForAi';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';

const REOPEN_PROMPT_MESSAGE =
  'Você quer continuar o atendimento anterior, ou é um assunto novo? Responda 1 para continuar ou 2 para um novo assunto.';

export async function POST(request: Request, { params }: { params: { secret: string } }) {
  if (params.secret !== process.env.WEBHOOK_SECRET) {
    return Response.json({ ok: true, ignored: true });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.warn('Instagram webhook: malformed JSON body, discarding', error);
    return Response.json({ ok: true, ignored: true });
  }

  const parsed = parseInstagramWebhook(payload);

  if (!parsed) {
    return Response.json({ ok: true, ignored: true });
  }

  const result = await persistInboundMessage({
    channel: 'INSTAGRAM',
    phone: parsed.senderId,
    text: parsed.text,
    externalId: parsed.messageId,
    name: parsed.name,
    profilePictureUrl: parsed.profilePictureUrl,
  });
  await broadcastEvent({ type: 'queue:updated' });
  await broadcastEvent({ type: 'message:new', conversationId: result.conversationId });

  if (result.needsReopenPrompt) {
    await enqueueOutboundMessage({ conversationId: result.conversationId, content: REOPEN_PROMPT_MESSAGE });
  } else if (result.status === 'AI_HANDLING') {
    try {
      await processInboundForAi(result.conversationId);
    } catch (error) {
      console.error('AI triage threw, conversation left for the queue', error);
    }
  }

  return Response.json({ ok: true });
}
