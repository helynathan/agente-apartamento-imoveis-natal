import OpenAI from 'openai';

export interface ConversationMessageInput {
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
}

function buildSystemPrompt(productContext?: string): string {
  const lines = [
    'Você é uma copiloto de IA ajudando um atendente humano de suporte via WhatsApp.',
    'Sugira uma resposta apropriada para a próxima mensagem, baseada no histórico da conversa.',
    'Responda apenas com o texto da mensagem sugerida, sem explicações ou formatação extra.',
  ];

  if (productContext) {
    lines.push('', 'Informações de produtos relevantes para esta conversa:', productContext);
  }

  return lines.join('\n');
}

export async function requestCopilotSuggestion(params: {
  messages: ConversationMessageInput[];
  productContext?: string;
}): Promise<string> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15_000,
    maxRetries: 1,
  });

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(params.productContext) },
    ...params.messages.map((m) => ({
      role: m.direction === 'INBOUND' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: chatMessages,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response has no content');
  }

  return content;
}
