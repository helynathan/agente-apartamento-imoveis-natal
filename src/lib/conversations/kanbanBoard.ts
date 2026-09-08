import { db } from '@/lib/db';
import type { Channel } from '@prisma/client';

export interface KanbanConversation {
  id: string;
  channel: Channel;
  customerExternalId: string;
  customerName: string | null;
  profilePictureUrl: string | null;
  lastInboundAt: Date | null;
  sectorName: string | null;
  assignedUserName: string | null;
  lastMessagePreview: string | null;
}

export interface KanbanColumns {
  aiHandling: KanbanConversation[];
  aiHandlingTotalCount: number;
  queued: KanbanConversation[];
  assigned: KanbanConversation[];
  closed: KanbanConversation[];
}

type RawConversation = {
  id: string;
  channel: Channel;
  customerExternalId: string;
  customerName: string | null;
  profilePictureUrl: string | null;
  lastInboundAt: Date | null;
  sector: { name: string } | null;
  assignedUser: { name: string | null } | null;
  messages: Array<{ content: string }>;
};

function toKanbanConversation(c: RawConversation): KanbanConversation {
  return {
    id: c.id,
    channel: c.channel,
    customerExternalId: c.customerExternalId,
    customerName: c.customerName,
    profilePictureUrl: c.profilePictureUrl,
    lastInboundAt: c.lastInboundAt,
    sectorName: c.sector?.name ?? null,
    assignedUserName: c.assignedUser?.name ?? null,
    lastMessagePreview: c.messages[0]?.content.slice(0, 140) ?? null,
  };
}

const INCLUDE = {
  sector: { select: { name: true } },
  assignedUser: { select: { name: true } },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { content: true } },
};

export async function getKanbanColumns(): Promise<KanbanColumns> {
  // updatedAt is used here as a proxy for "closed at" since there's no dedicated
  // closedAt field; this assumes closed conversations aren't routinely mutated afterward.
  const closedSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const aiHandlingActiveSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [aiHandling, aiHandlingTotalCount, queued, assigned, closed] = await Promise.all([
    db.conversation.findMany({
      where: { status: 'AI_HANDLING', lastInboundAt: { gte: aiHandlingActiveSince } },
      orderBy: { lastInboundAt: 'desc' },
      take: 50,
      include: INCLUDE,
    }),
    db.conversation.count({ where: { status: 'AI_HANDLING' } }),
    db.conversation.findMany({
      where: { status: 'QUEUED' },
      orderBy: { lastInboundAt: 'asc' },
      include: INCLUDE,
    }),
    db.conversation.findMany({
      where: { status: 'ASSIGNED' },
      orderBy: { lastInboundAt: 'desc' },
      include: INCLUDE,
    }),
    db.conversation.findMany({
      where: { status: 'CLOSED', updatedAt: { gte: closedSince } },
      orderBy: { updatedAt: 'desc' },
      include: INCLUDE,
    }),
  ]);

  return {
    aiHandling: aiHandling.map(toKanbanConversation),
    aiHandlingTotalCount,
    queued: queued.map(toKanbanConversation),
    assigned: assigned.map(toKanbanConversation),
    closed: closed.map(toKanbanConversation),
  };
}
