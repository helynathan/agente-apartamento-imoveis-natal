import { db } from '@/lib/db';
import { businessMinutesSince } from '@/lib/conversations/businessHours';

export async function findOverdueConversations(
  now: Date,
  slaMinutes: number
): Promise<Array<{ id: string; customerName: string | null; customerExternalId: string }>> {
  const candidates = await db.conversation.findMany({
    where: {
      status: { not: 'CLOSED' },
      slaEscalatedAt: null,
      lastInboundAt: { not: null },
    },
    select: {
      id: true,
      customerName: true,
      customerExternalId: true,
      lastInboundAt: true,
      lastOutboundAt: true,
    },
  });

  return candidates
    .filter((c) => !c.lastOutboundAt || c.lastOutboundAt < c.lastInboundAt!)
    .filter((c) => businessMinutesSince(c.lastInboundAt as Date, now) >= slaMinutes)
    .map((c) => ({ id: c.id, customerName: c.customerName, customerExternalId: c.customerExternalId }));
}
