import { db } from '@/lib/db';
import { listSectors } from '@/lib/sectors/sectorRepository';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';
import { requestTriageDecision } from '@/lib/ai/openaiClient';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { searchRelevantProducts } from '@/lib/products/searchRelevantProducts';
import { findPostListingByMediaId } from '@/lib/posts/postListingRepository';
import { notifyLeadToCrm, type LeadHistoryMessage } from '@/lib/crm/notifyLeadToCrm';

const SAFETY_NET_LIMIT = 6;
const FALLBACK_MESSAGE = 'Vou te encaminhar para um atendente, só um momento.';

async function handOffToQueue(conversationId: string, sectorId: string | null): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: 'QUEUED', sectorId, aiMessageCount: 0 },
  });
  await broadcastEvent({ type: 'queue:updated' });
  await broadcastEvent({ type: 'conversation:updated', conversationId });
}

async function closeConversation(conversationId: string, sectorId: string | null): Promise<void> {
  await db.conversation.update({
    where: { id: conversationId },
    data: { status: 'CLOSED', sectorId },
  });
  await broadcastEvent({ type: 'queue:updated' });
  await broadcastEvent({ type: 'conversation:updated', conversationId });
}

async function syncLeadToCrm(params: {
  conversationId: string;
  customerPhone: string;
  customerName: string | null;
  messages: LeadHistoryMessage[];
  interesse: string | undefined;
  canal: 'WhatsApp' | 'Instagram';
  link: string;
}): Promise<boolean> {
  try {
    await notifyLeadToCrm({
      telefone: params.customerPhone,
      nome: params.customerName ?? undefined,
      historico: params.messages,
      interesse: params.interesse,
      canal: params.canal,
      link: params.link,
    });

    await db.conversation.update({
      where: { id: params.conversationId },
      data: { crmSyncedAt: new Date(), crmSyncError: null },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to notify CRM lead', error);
    try {
      await db.conversation.update({
        where: { id: params.conversationId },
        data: { crmSyncError: message },
      });
    } catch (dbError) {
      console.error('Failed to record crmSyncError', dbError);
    }
    return false;
  }
}

export async function processInboundForAi(conversationId: string): Promise<void> {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!conversation || conversation.status !== 'AI_HANDLING') {
    return;
  }

  if (conversation.aiMessageCount >= SAFETY_NET_LIMIT) {
    await enqueueOutboundMessage({ conversationId, content: FALLBACK_MESSAGE });
    await handOffToQueue(conversationId, null);
    return;
  }

  const pendingOutbound = await db.outboundMessage.findMany({
    where: { conversationId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  const sectors = await listSectors();
  const messages = [
    ...conversation.messages.map((m) => ({ createdAt: m.createdAt, direction: m.direction, content: m.content })),
    ...pendingOutbound.map((m) => ({ createdAt: m.createdAt, direction: 'OUTBOUND' as const, content: m.content })),
  ]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((m) => ({ direction: m.direction, content: m.content }));

  const lastInboundMessage = [...conversation.messages].reverse().find((m) => m.direction === 'INBOUND');
  let productContext: string | undefined;

  if (conversation.originMediaId) {
    try {
      const listing = await findPostListingByMediaId(conversation.originMediaId);
      if (listing) {
        productContext = listing.propertyText.slice(0, 6000);
      }
    } catch (error) {
      console.warn('Post listing lookup failed, continuing without post context', error);
    }
  }

  let products: Array<{ url: string; content: string }> = [];
  if (!productContext && lastInboundMessage) {
    try {
      products = await searchRelevantProducts(lastInboundMessage.content, 3);
      if (products.length > 0) {
        productContext = products.map((p) => `- ${p.url}: ${p.content.slice(0, 2000)}`).join('\n');
      }
    } catch (error) {
      console.warn('Product search failed, continuing without product context', error);
    }
  }

  try {
    const hasLeadPhone = conversation.channel === 'WHATSAPP' || Boolean(conversation.leadPhone);
    const decision = await requestTriageDecision({
      messages,
      sectors,
      productContext,
      channel: conversation.channel,
      hasLeadPhone,
    });

    await enqueueOutboundMessage({ conversationId, content: decision.mensagem });

    if (decision.acao === 'encaminhar') {
      await handOffToQueue(conversationId, decision.sectorId ?? null);
    }

    let leadPhone = conversation.leadPhone;
    if (decision.telefoneCapturado && !leadPhone) {
      leadPhone = decision.telefoneCapturado;
      try {
        await db.conversation.update({ where: { id: conversationId }, data: { leadPhone } });
      } catch (error) {
        console.error('Failed to persist captured lead phone', error);
      }
    }

    if (decision.eLead && !conversation.isLead) {
      try {
        await db.conversation.update({ where: { id: conversationId }, data: { isLead: true } });
      } catch (error) {
        console.error('Failed to persist isLead flag', error);
      }
    }

    const canSyncLead = conversation.channel === 'WHATSAPP' || Boolean(leadPhone);

    if ((decision.eLead || conversation.isLead) && !conversation.crmSyncedAt && canSyncLead) {
      const interesse =
        decision.acao === 'encaminhar'
          ? sectors.find((s) => s.id === decision.sectorId)?.name
          : undefined;

      const synced = await syncLeadToCrm({
        conversationId,
        customerPhone: conversation.channel === 'WHATSAPP' ? conversation.customerExternalId : (leadPhone as string),
        customerName: conversation.customerName,
        messages,
        interesse,
        canal: conversation.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram',
        link: `${process.env.NEXTAUTH_URL}/painel/conversas/${conversationId}`,
      });

      if (synced) {
        await closeConversation(conversationId, decision.acao === 'encaminhar' ? decision.sectorId ?? null : null);
      }
    }
  } catch (error) {
    console.warn('AI triage failed, handing off to queue', error);
    await enqueueOutboundMessage({ conversationId, content: FALLBACK_MESSAGE });
    await handOffToQueue(conversationId, null);
  }
}
