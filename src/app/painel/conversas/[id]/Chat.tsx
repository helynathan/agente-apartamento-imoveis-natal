'use client';

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { sendMessageAction } from '../actions';
import { CopilotPanel } from './CopilotPanel';

type ChatMessage = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
};

type PendingMessage = ChatMessage & { pending: true };

export function Chat({
  conversationId,
  initialMessages,
  canSend,
  showCopilot,
}: {
  conversationId: string;
  initialMessages: ChatMessage[];
  canSend: boolean;
  showCopilot: boolean;
}) {
  const [text, setText] = useState('');
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevOutboundCount = useRef(initialMessages.filter((m) => m.direction === 'OUTBOUND').length);

  // The outbound worker sends messages on its own 15s cadence, so the real
  // Message row only lands some time after submit. Once revalidation brings
  // in N new confirmed OUTBOUND messages, drop the oldest N optimistic
  // placeholders (FIFO — matches the worker's send order) instead of
  // matching by content, since two sends can share the same text.
  useEffect(() => {
    const currentCount = initialMessages.filter((m) => m.direction === 'OUTBOUND').length;
    const increase = currentCount - prevOutboundCount.current;
    if (increase > 0) {
      setPendingMessages((prev) => prev.slice(increase));
    }
    prevOutboundCount.current = currentCount;
  }, [initialMessages]);

  function handleSubmit(formData: FormData) {
    const content = String(formData.get('content') ?? '').trim();
    if (!content) return;

    setPendingMessages((prev) => [...prev, { id: `pending-${Date.now()}`, direction: 'OUTBOUND', content, pending: true }]);
    setText('');

    startTransition(async () => {
      await sendMessageAction(formData);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleUseSuggestion(suggestion: string) {
    setText(suggestion);
    textareaRef.current?.focus();
  }

  const allMessages: (ChatMessage | PendingMessage)[] = [...initialMessages, ...pendingMessages];

  return (
    <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-nathai-mist bg-white p-4 shadow-card">
          {allMessages.map((message) => (
            <div
              key={message.id}
              className={
                message.direction === 'OUTBOUND'
                  ? 'ml-auto max-w-xs rounded-2xl rounded-br-md bg-gradient-to-br from-nathai-blue to-nathai-cyan px-3 py-2 text-sm text-white shadow-sm'
                  : 'mr-auto max-w-xs rounded-2xl rounded-bl-md bg-nathai-mist px-3 py-2 text-sm text-nathai-ink'
              }
            >
              {message.content}
              {'pending' in message && <span className="ml-2 text-xs text-white/60">enviando…</span>}
            </div>
          ))}
        </div>

        {canSend && (
          <form ref={formRef} action={handleSubmit} className="flex gap-2">
            <input type="hidden" name="conversationId" value={conversationId} />
            <textarea
              ref={textareaRef}
              name="content"
              required
              rows={2}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              placeholder="Escreva uma mensagem... (Enter envia, Shift+Enter quebra linha)"
            />
            <button
              type="submit"
              disabled={isPending}
              className="self-end rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan px-4 py-2 font-display text-sm font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-button"
            >
              Enviar
            </button>
          </form>
        )}
      </div>

      {showCopilot && canSend && <CopilotPanel conversationId={conversationId} onUseSuggestion={handleUseSuggestion} />}
    </div>
  );
}
