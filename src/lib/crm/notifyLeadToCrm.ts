export interface LeadHistoryMessage {
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
}

export interface LeadPayload {
  telefone: string;
  nome?: string;
  historico: LeadHistoryMessage[];
  interesse?: string;
  canal?: 'WhatsApp' | 'Instagram';
  link: string;
}

export async function notifyLeadToCrm(payload: LeadPayload): Promise<void> {
  const url = process.env.N8N_LEAD_WEBHOOK_URL;
  if (!url) {
    throw new Error('N8N_LEAD_WEBHOOK_URL is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`N8N lead webhook responded with HTTP ${response.status}`);
  }
}
