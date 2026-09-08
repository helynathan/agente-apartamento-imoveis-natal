'use client';

import { useState } from 'react';
import type { KanbanColumns } from '@/lib/conversations/kanbanBoard';
import { ConversationCard, type CardAccent } from './ConversationCard';

type ColumnKey = Exclude<keyof KanbanColumns, 'aiHandlingTotalCount'>;

const COLUMN_LABELS: Record<ColumnKey, string> = {
  aiHandling: 'Com a IA',
  queued: 'Aguardando',
  assigned: 'Em Atendimento',
  closed: 'Encerradas',
};

const COLUMN_ACCENT: Record<ColumnKey, CardAccent> = {
  aiHandling: 'cyan',
  queued: 'amber',
  assigned: 'neutral',
  closed: 'neutral',
};

const COLUMN_BODY_BG: Record<CardAccent, string> = {
  cyan: 'bg-nathai-cyan/10',
  amber: 'bg-nathai-amber/10',
  neutral: 'bg-nathai-mist/40',
};

const COLUMN_HEADER_BG: Record<CardAccent, string> = {
  cyan: 'bg-nathai-cyan/25 text-nathai-ink',
  amber: 'bg-nathai-amber/25 text-nathai-ink',
  neutral: 'bg-nathai-mist text-nathai-ink',
};

const COLUMN_DOT: Record<CardAccent, string> = {
  cyan: 'bg-gradient-to-br from-nathai-cyan to-nathai-blue',
  amber: 'bg-nathai-amber',
  neutral: 'bg-gradient-to-br from-nathai-blue to-nathai-cyan',
};

const COLUMN_ORDER: ColumnKey[] = ['aiHandling', 'queued', 'assigned', 'closed'];

export function KanbanBoard({
  columns,
  sectors,
}: {
  columns: KanbanColumns;
  sectors: Array<{ id: string; name: string }>;
}) {
  const [mobileTab, setMobileTab] = useState<ColumnKey>('aiHandling');

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
        {COLUMN_ORDER.map((key) => {
          const count = key === 'aiHandling' ? columns.aiHandlingTotalCount : columns[key].length;
          const active = mobileTab === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setMobileTab(key)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 font-display text-xs font-medium transition-all duration-200 ${
                active
                  ? `${COLUMN_HEADER_BG[COLUMN_ACCENT[key]]} shadow-sm`
                  : 'bg-nathai-mist/40 text-nathai-ink/50 hover:-translate-y-0.5'
              }`}
            >
              {COLUMN_LABELS[key]} <span className="font-mono">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((key) => {
          const accent = COLUMN_ACCENT[key];
          const count = key === 'aiHandling' ? columns.aiHandlingTotalCount : columns[key].length;

          return (
            <section
              key={key}
              className={`w-full flex-shrink-0 rounded-2xl md:w-72 ${COLUMN_BODY_BG[accent]} ${
                mobileTab === key ? 'block' : 'hidden'
              } md:block`}
            >
              <h2
                className={`font-display flex items-center justify-between rounded-t-2xl px-3 py-2 text-sm font-medium ${COLUMN_HEADER_BG[accent]}`}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${COLUMN_DOT[accent]}`} />
                  {COLUMN_LABELS[key]}
                </span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 font-mono text-xs text-nathai-ink/70">
                  {count}
                </span>
              </h2>
              <div className="flex flex-col gap-2 p-3">
                {columns[key].map((conversation) => (
                  <ConversationCard
                    key={conversation.id}
                    conversation={conversation}
                    sectors={key === 'queued' || key === 'aiHandling' ? sectors : undefined}
                    accent={accent}
                  />
                ))}
                {columns[key].length === 0 && <p className="text-xs text-nathai-ink/30">Nada por aqui.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
