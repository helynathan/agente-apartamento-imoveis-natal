import { parseInboundWebhook } from '@/lib/webhook/parseInboundWebhook';
import { persistInboundMessage } from '@/lib/conversations/persistInboundMessage';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { processInboundForAi } from '@/lib/ai/processInboundForAi';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';
import { fetchProfilePictureUrl } from '@/lib/evolutionApi';
import { db } from '@/lib/db';

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
    console.warn('Evolution webhook: malformed JSON body, discarding', error);
    return Response.json({ ok: true, ignored: true });
  }

  const parsed = parseInboundWebhook(payload);

  if (!parsed) {
    return Response.json({ ok: true, ignored: true });
  }

  const result = await persistInboundMessage({ ...parsed, channel: 'WHATSAPP' });
  await broadcastEvent({ type: 'queue:updated' });
  await broadcastEvent({ type: 'message:new', conversationId: result.conversationId });

  if (result.isNewConversation) {
    try {
      const profilePictureUrl = await fetchProfilePictureUrl(parsed.phone);
      if (profilePictureUrl) {
        await db.conversation.update({
          where: { id: result.conversationId },
          data: { profilePictureUrl },
        });
      }
    } catch (error) {
      console.warn('Failed to fetch WhatsApp profile picture, continuing without it', error);
    }
  }

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
