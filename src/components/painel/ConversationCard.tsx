import Link from 'next/link';
import type { KanbanConversation } from '@/lib/conversations/kanbanBoard';
import { formatWaitingTime } from '@/lib/conversations/formatWaitingTime';
import { claimConversationAction } from '@/app/painel/conversas/actions';
import { ChannelIcon } from '@/components/painel/ChannelIcon';

export type CardAccent = 'cyan' | 'amber' | 'neutral';

const ACCENT_BORDER: Record<CardAccent, string> = {
  cyan: 'border-l-nathai-cyan',
  amber: 'border-l-nathai-amber',
  neutral: 'border-l-nathai-mist',
};

const ACCENT_AVATAR: Record<CardAccent, string> = {
  cyan: 'bg-gradient-to-br from-nathai-cyan to-nathai-blue',
  amber: 'bg-nathai-amber',
  neutral: 'bg-gradient-to-br from-nathai-blue to-nathai-cyan',
};

function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

export function ConversationCard({
  conversation,
  sectors,
  accent = 'neutral',
}: {
  conversation: KanbanConversation;
  sectors?: Array<{ id: string; name: string }>;
  accent?: CardAccent;
}) {
  const waitingText = conversation.lastInboundAt
    ? formatWaitingTime(conversation.lastInboundAt, new Date())
    : null;
  const displayName = conversation.customerName ?? conversation.customerExternalId;

  return (
    <div
      className={`rounded-[20px] border border-l-4 border-nathai-mist bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover ${ACCENT_BORDER[accent]}`}
    >
      <div className="flex items-start gap-3">
        {conversation.profilePictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={conversation.profilePictureUrl}
            alt=""
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-sm font-medium text-white ${ACCENT_AVATAR[accent]}`}
          >
            {initialsOf(displayName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/painel/conversas/${conversation.id}`}
              className="block min-w-0 truncate font-medium text-nathai-ink hover:text-nathai-blue hover:underline"
            >
              {displayName}
            </Link>
            <ChannelIcon channel={conversation.channel} className="h-4 w-4 flex-shrink-0" />
          </div>
          {conversation.customerName && (
            <div className="text-xs text-nathai-ink/50">{conversation.customerExternalId}</div>
          )}
          {waitingText && (
            <div className="mt-1 font-mono text-xs tracking-tight text-nathai-ink/40">{waitingText}</div>
          )}
        </div>
      </div>

      {(conversation.sectorName || conversation.assignedUserName) && (
        <div className="mt-2 text-xs text-nathai-ink/60">
          {conversation.sectorName}
          {conversation.sectorName && conversation.assignedUserName && ' · '}
          {conversation.assignedUserName}
        </div>
      )}
      {conversation.lastMessagePreview && (
        <p className="mt-2 truncate text-sm text-nathai-ink/80">{conversation.lastMessagePreview}</p>
      )}
      {sectors && (
        <form action={claimConversationAction} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <select
            name="sectorId"
            required
            className="flex-1 rounded-lg border border-nathai-mist px-2 py-1 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
          >
            <option value="">Setor...</option>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-nathai-blue to-nathai-cyan px-3 py-1 font-display text-sm font-medium text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
          >
            Pegar
          </button>
        </form>
      )}
    </div>
  );
}
