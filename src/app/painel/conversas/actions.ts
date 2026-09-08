'use server';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';
import { claimConversation } from '@/lib/conversations/claimConversation';
import { enqueueOutboundMessage } from '@/lib/queue/enqueueOutboundMessage';
import { db } from '@/lib/db';
import { broadcastEvent } from '@/lib/realtime/broadcast';
import { revalidatePath } from 'next/cache';

export async function claimConversationAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Não autenticado.');

  const conversationId = String(formData.get('conversationId'));
  const sectorId = String(formData.get('sectorId'));

  const result = await claimConversation({ conversationId, userId: session.user.id, sectorId });

  if (!result.claimed) {
    throw new Error('Esta conversa já foi assumida por outro atendente.');
  }

  await enqueueOutboundMessage({
    conversationId,
    content: `Você está sendo atendido(a) por ${session.user.name ?? 'um atendente'} agora.`,
  });

  await broadcastEvent({ type: 'queue:updated' });
  await broadcastEvent({ type: 'conversation:updated', conversationId });
  redirect(`/painel/conversas/${conversationId}`);
}

export async function sendMessageAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Não autenticado.');

  const conversationId = String(formData.get('conversationId'));
  const content = String(formData.get('content') ?? '').trim();
  if (!content) return;

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { status: true },
  });
  if (!conversation || conversation.status === 'CLOSED') {
    throw new Error('Não é possível enviar mensagem para uma conversa encerrada.');
  }

  await enqueueOutboundMessage({ conversationId, content });
  revalidatePath(`/painel/conversas/${conversationId}`);
}

export async function closeConversationAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('Não autenticado.');

  const conversationId = String(formData.get('conversationId'));
  await db.conversation.update({ where: { id: conversationId }, data: { status: 'CLOSED' } });

  await broadcastEvent({ type: 'queue:updated' });
  await broadcastEvent({ type: 'conversation:updated', conversationId });
  redirect('/painel');
}
