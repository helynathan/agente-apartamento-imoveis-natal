import OpenAI from 'openai';

export interface ConversationMessageInput {
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
}

export interface SectorInput {
  id: string;
  name: string;
}

export interface TriageDecision {
  acao: 'responder' | 'perguntar_setor' | 'encaminhar';
  mensagem: string;
  sectorId?: string;
  eLead: boolean;
  telefoneCapturado?: string;
}

const TRIAGE_SCHEMA = {
  name: 'triage_decision',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      acao: { type: 'string', enum: ['responder', 'perguntar_setor', 'encaminhar'] },
      mensagem: { type: 'string' },
      sectorId: { type: ['string', 'null'] },
      eLead: { type: 'boolean' },
      telefoneCapturado: { type: ['string', 'null'] },
    },
    required: ['acao', 'mensagem', 'sectorId', 'eLead', 'telefoneCapturado'],
    additionalProperties: false,
  },
} as const;

function buildSystemPrompt(
  sectors: SectorInput[],
  channel: 'WHATSAPP' | 'INSTAGRAM',
  hasLeadPhone: boolean,
  productContext?: string
): string {
  const sectorList = sectors.map((s) => `- ${s.id}: ${s.name}`).join('\n');
  const lines = [
    channel === 'INSTAGRAM'
      ? 'Você é uma atendente de suporte via Instagram. Tente resolver a dúvida do cliente diretamente.'
      : 'Você é uma atendente de suporte via WhatsApp. Tente resolver a dúvida do cliente diretamente.',
    'Se não conseguir resolver, você deve encaminhar para um atendente humano de um setor específico.',
    'Se não tiver certeza de qual setor é adequado, pergunte ao cliente antes de encaminhar.',
    '',
    'Use estes padrões comuns para identificar o setor certo:',
    '- Administrativo: cliente quer colocar um imóvel para alugar (captação) ou precisa de assessoria/documentação sobre um imóvel.',
    '- Comercial: cliente quer comprar ou alugar um imóvel como comprador ou inquilino.',
    '- Financeiro: cliente tem dúvida sobre pagamento, boleto ou outra questão financeira de um contrato.',
    '',
    'Setores disponíveis (use o id exato ao encaminhar):',
    sectorList || '(nenhum setor cadastrado)',
  ];

  if (productContext) {
    lines.push('', 'Informações de produtos relevantes para esta conversa:', productContext);
  }

  lines.push(
    '',
    'Além da ação, sempre inclua o campo eLead (true ou false): marque true quando a mensagem do cliente demonstrar interesse comercial — comprar, alugar ou administrar um imóvel, ou interesse em algum produto do catálogo. Caso contrário, marque false.'
  );

  if (channel === 'INSTAGRAM' && !hasLeadPhone) {
    lines.push(
      '',
      'Este atendimento é pelo Instagram, onde ainda não temos o telefone do cliente.',
      'Se eLead for true, peça o telefone/WhatsApp do cliente na sua mensagem antes de qualquer outra coisa.',
      'Se identificar um telefone de contato na mensagem do cliente, preencha o campo telefoneCapturado com esse número; caso contrário, deixe telefoneCapturado como null.'
    );
  } else {
    lines.push(
      '',
      'Deixe o campo telefoneCapturado como null, a menos que identifique um novo telefone de contato na mensagem do cliente.'
    );
  }

  lines.push(
    '',
    'Responda sempre com uma destas ações:',
    '- "responder": você está tentando resolver, sem encaminhar ainda.',
    '- "perguntar_setor": você precisa perguntar ao cliente qual assunto/setor antes de encaminhar.',
    '- "encaminhar": você decidiu encaminhar; inclua o sectorId exato de um dos setores listados.'
  );

  return lines.join('\n');
}

export async function requestTriageDecision(params: {
  messages: ConversationMessageInput[];
  sectors: SectorInput[];
  channel?: 'WHATSAPP' | 'INSTAGRAM';
  hasLeadPhone?: boolean;
  productContext?: string;
}): Promise<TriageDecision> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15_000,
    maxRetries: 1,
  });

  const channel = params.channel ?? 'WHATSAPP';
  const hasLeadPhone = params.hasLeadPhone ?? true;

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(params.sectors, channel, hasLeadPhone, params.productContext) },
    ...params.messages.map((m) => ({
      role: m.direction === 'INBOUND' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: chatMessages,
    response_format: { type: 'json_schema', json_schema: TRIAGE_SCHEMA },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI response has no content');
  }

  const parsed = JSON.parse(content) as {
    acao: string;
    mensagem: string;
    sectorId: string | null;
    eLead: unknown;
    telefoneCapturado?: string | null;
  };

  if (!['responder', 'perguntar_setor', 'encaminhar'].includes(parsed.acao)) {
    throw new Error(`Invalid acao in AI response: ${parsed.acao}`);
  }
  if (typeof parsed.mensagem !== 'string' || parsed.mensagem.length === 0) {
    throw new Error('AI response has an empty mensagem');
  }
  if (parsed.acao === 'encaminhar') {
    if (!parsed.sectorId || !params.sectors.some((s) => s.id === parsed.sectorId)) {
      throw new Error(`AI response's sectorId is missing or unknown: ${parsed.sectorId}`);
    }
  }
  if (typeof parsed.eLead !== 'boolean') {
    throw new Error('AI response has an invalid eLead flag');
  }
  if (parsed.telefoneCapturado != null && typeof parsed.telefoneCapturado !== 'string') {
    throw new Error('AI response has an invalid telefoneCapturado field');
  }

  return {
    acao: parsed.acao as TriageDecision['acao'],
    mensagem: parsed.mensagem,
    sectorId: parsed.sectorId ?? undefined,
    eLead: parsed.eLead,
    telefoneCapturado: parsed.telefoneCapturado ?? undefined,
  };
}
