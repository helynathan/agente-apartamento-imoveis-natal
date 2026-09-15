import { db } from '@/lib/db';

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
      status: true,
      lastInboundAt: true,
      lastOutboundAt: true,
    },
  });

  return candidates
    .filter((c) => c.status === 'QUEUED' || !c.lastOutboundAt || c.lastOutboundAt < c.lastInboundAt!)
    .filter((c) => (now.getTime() - (c.lastInboundAt as Date).getTime()) / 60_000 >= slaMinutes)
    .map((c) => ({ id: c.id, customerName: c.customerName, customerExternalId: c.customerExternalId }));
}
