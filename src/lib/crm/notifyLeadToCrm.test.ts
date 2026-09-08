import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyLeadToCrm } from '@/lib/crm/notifyLeadToCrm';

describe('notifyLeadToCrm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts the payload as JSON to N8N_LEAD_WEBHOOK_URL', async () => {
    vi.stubEnv('N8N_LEAD_WEBHOOK_URL', 'https://n8n.example.com/webhook/lead');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await notifyLeadToCrm({
      telefone: '5511999999999',
      nome: 'Cliente Teste',
      historico: [{ direction: 'INBOUND', content: 'Quero alugar um apê' }],
      interesse: 'Locação',
      link: 'https://atende.example.com/painel/conversas/conv-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/lead',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        signal: expect.any(AbortSignal),
        body: JSON.stringify({
          telefone: '5511999999999',
          nome: 'Cliente Teste',
          historico: [{ direction: 'INBOUND', content: 'Quero alugar um apê' }],
          interesse: 'Locação',
          link: 'https://atende.example.com/painel/conversas/conv-1',
        }),
      })
    );
  });

  it('throws when N8N_LEAD_WEBHOOK_URL is not configured', async () => {
    vi.stubEnv('N8N_LEAD_WEBHOOK_URL', '');

    await expect(
      notifyLeadToCrm({ telefone: '5511999999999', historico: [], link: 'https://atende.example.com/painel/conversas/conv-1' })
    ).rejects.toThrow('N8N_LEAD_WEBHOOK_URL is not configured');
  });

  it('throws when the webhook responds with a non-ok status', async () => {
    vi.stubEnv('N8N_LEAD_WEBHOOK_URL', 'https://n8n.example.com/webhook/lead');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(
      notifyLeadToCrm({ telefone: '5511999999999', historico: [], link: 'https://atende.example.com/painel/conversas/conv-1' })
    ).rejects.toThrow('HTTP 500');
  });

  it('propagates a fetch failure (e.g. timeout)', async () => {
    vi.stubEnv('N8N_LEAD_WEBHOOK_URL', 'https://n8n.example.com/webhook/lead');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(
      notifyLeadToCrm({ telefone: '5511999999999', historico: [], link: 'https://atende.example.com/painel/conversas/conv-1' })
    ).rejects.toThrow('network down');
  });
});
