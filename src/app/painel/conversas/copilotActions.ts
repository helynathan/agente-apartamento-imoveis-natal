'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { db } from '@/lib/db';
import { requestCopilotSuggestion } from '@/lib/ai/requestCopilotSuggestion';
import { searchRelevantProducts } from '@/lib/products/searchRelevantProducts';

export async function generateCopilotSuggestionAction(
  conversationId: string
): Promise<{ suggestion: string } | { error: string }> {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error('Não autenticado.');
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!conversation) {
    return { error: 'Conversa não encontrada.' };
  }

  const messages = conversation.messages.map((m) => ({
    direction: m.direction,
    content: m.content,
  }));

  const lastInboundMessage = [...conversation.messages].reverse().find((m) => m.direction === 'INBOUND');
  let productContext: string | undefined;
  if (lastInboundMessage) {
    try {
      const products = await searchRelevantProducts(lastInboundMessage.content, 3);
      if (products.length > 0) {
        productContext = products.map((p) => `- ${p.url}: ${p.content.slice(0, 2000)}`).join('\n');
      }
    } catch (error) {
      console.warn('Product search failed, continuing without product context', error);
    }
  }

  try {
    const suggestion = await requestCopilotSuggestion({ messages, productContext });
    return { suggestion };
  } catch (error) {
    console.error('Copilot suggestion failed', error);
    return { error: 'Não foi possível gerar uma sugestão agora.' };
  }
}
