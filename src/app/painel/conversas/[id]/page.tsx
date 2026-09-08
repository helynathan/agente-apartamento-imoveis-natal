import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { closeConversationAction } from '../actions';
import { RealtimeRefresher } from '@/lib/realtime/RealtimeRefresher';
import { ChannelIcon } from '@/components/painel/ChannelIcon';
import { Chat } from './Chat';

export default async function ConversaPage({ params }: { params: { id: string } }) {
  const conversation = await db.conversation.findUnique({
    where: { id: params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!conversation) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col p-8">
      <RealtimeRefresher eventTypes={['message:new', 'conversation:updated']} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display flex items-center gap-2 text-xl font-medium text-nathai-ink">
          {conversation.customerName ?? conversation.customerExternalId}
          <ChannelIcon channel={conversation.channel} className="h-5 w-5 flex-shrink-0" />
        </h1>
        {conversation.status !== 'CLOSED' && (
          <form action={closeConversationAction}>
            <input type="hidden" name="conversationId" value={conversation.id} />
            <button
              type="submit"
              className="rounded border border-nathai-mist px-3 py-1 text-sm text-nathai-ink/70 transition hover:bg-nathai-paper"
            >
              Encerrar
            </button>
          </form>
        )}
      </div>

      <Chat
        conversationId={conversation.id}
        initialMessages={conversation.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          content: m.content,
        }))}
        canSend={conversation.status !== 'CLOSED'}
        showCopilot={conversation.status === 'ASSIGNED'}
      />
    </main>
  );
}
