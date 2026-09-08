import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/ai/requestEmbedding', () => ({
  requestEmbedding: vi.fn(),
}));
vi.mock('@/lib/products/vistaApi', () => ({
  listarImoveis: vi.fn(),
  gerarLinksImoveis: vi.fn(),
}));

import { requestEmbedding } from '@/lib/ai/requestEmbedding';
import { listarImoveis, gerarLinksImoveis } from '@/lib/products/vistaApi';
import { crawlProductPages } from '@/lib/products/crawlProductPages';

const EMBEDDING = (() => {
  const values = new Array(1536).fill(0);
  values[0] = 0.1;
  return values;
})();

function imovel(codigo: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    Codigo: codigo,
    Categoria: 'Apartamento',
    Bairro: 'Petrópolis',
    Cidade: 'Natal',
    ValorVenda: '650000',
    ValorLocacao: '0',
    Dormitorios: '3',
    Suites: '2',
    Vagas: '2',
    AreaTotal: '95',
    AreaPrivativa: '0',
    Caracteristicas: { 'Agua Quente': 'Sim' },
    InfraEstrutura: {},
    ...overrides,
  };
}

describe('crawlProductPages', () => {
  afterEach(async () => {
    vi.mocked(listarImoveis).mockReset();
    vi.mocked(gerarLinksImoveis).mockReset();
    vi.mocked(requestEmbedding).mockReset();
    await db.productPage.deleteMany();
  });

  it('creates a ProductPage per listing with content, url, and embedding', async () => {
    vi.mocked(listarImoveis).mockResolvedValue({ imoveis: [imovel('10001')], totalPaginas: 1 });
    vi.mocked(gerarLinksImoveis).mockResolvedValue([{ codigo: '10001', url: 'https://example.com/10001' }]);
    vi.mocked(requestEmbedding).mockResolvedValue(EMBEDDING);

    await crawlProductPages();

    const page = await db.productPage.findUnique({ where: { codigo: '10001' } });
    expect(page?.url).toBe('https://example.com/10001');
    expect(page?.content).toContain('Petrópolis');
    expect(page?.content).toContain('3 dormitórios');
    expect(page?.lastCrawledAt).not.toBeNull();
    expect(page?.lastError).toBeNull();
  });

  it('pages through listarImoveis until totalPaginas is reached', async () => {
    vi.mocked(listarImoveis)
      .mockResolvedValueOnce({ imoveis: [imovel('1')], totalPaginas: 2 })
      .mockResolvedValueOnce({ imoveis: [imovel('2')], totalPaginas: 2 });
    vi.mocked(gerarLinksImoveis).mockImplementation(async (codigos) =>
      codigos.map((codigo) => ({ codigo, url: `https://example.com/${codigo}` }))
    );
    vi.mocked(requestEmbedding).mockResolvedValue(EMBEDDING);

    await crawlProductPages();

    expect(listarImoveis).toHaveBeenCalledTimes(2);
    expect(await db.productPage.count()).toBe(2);
  });

  it('records lastError and keeps the listing without content when link generation fails for the whole batch', async () => {
    vi.mocked(listarImoveis).mockResolvedValue({ imoveis: [imovel('10001')], totalPaginas: 1 });
    vi.mocked(gerarLinksImoveis).mockRejectedValue(new Error('HTTP 500'));

    await crawlProductPages();

    const page = await db.productPage.findUnique({ where: { codigo: '10001' } });
    expect(page?.lastError).toContain('HTTP 500');
    expect(page?.content).toBe('');
    expect(requestEmbedding).not.toHaveBeenCalled();
  });

  it('records lastError for one listing without aborting the rest of the batch', async () => {
    vi.mocked(listarImoveis).mockResolvedValue({
      imoveis: [imovel('10001'), imovel('10002')],
      totalPaginas: 1,
    });
    vi.mocked(gerarLinksImoveis).mockResolvedValue([
      { codigo: '10001', url: 'https://example.com/10001' },
      { codigo: '10002', url: 'https://example.com/10002' },
    ]);
    vi.mocked(requestEmbedding)
      .mockRejectedValueOnce(new Error('OpenAI down'))
      .mockResolvedValueOnce(EMBEDDING);

    await crawlProductPages();

    const failed = await db.productPage.findUnique({ where: { codigo: '10001' } });
    const succeeded = await db.productPage.findUnique({ where: { codigo: '10002' } });
    expect(failed?.lastError).toContain('OpenAI down');
    expect(succeeded?.lastError).toBeNull();
    expect(succeeded?.content).not.toBe('');
  });

  it('removes ProductPages whose codigo is missing from this cycle (reconciliation)', async () => {
    await db.productPage.create({ data: { codigo: 'stale', url: 'https://example.com/stale' } });
    vi.mocked(listarImoveis).mockResolvedValue({ imoveis: [imovel('10001')], totalPaginas: 1 });
    vi.mocked(gerarLinksImoveis).mockResolvedValue([{ codigo: '10001', url: 'https://example.com/10001' }]);
    vi.mocked(requestEmbedding).mockResolvedValue(EMBEDDING);

    await crawlProductPages();

    expect(await db.productPage.findUnique({ where: { codigo: 'stale' } })).toBeNull();
    expect(await db.productPage.findUnique({ where: { codigo: '10001' } })).not.toBeNull();
  });

  it('does not reconcile (delete existing rows) when listarImoveis returns zero listings', async () => {
    await db.productPage.create({ data: { codigo: 'existing', url: 'https://example.com/existing' } });
    vi.mocked(listarImoveis).mockResolvedValue({ imoveis: [], totalPaginas: 1 });

    await crawlProductPages();

    expect(await db.productPage.findUnique({ where: { codigo: 'existing' } })).not.toBeNull();
    expect(gerarLinksImoveis).not.toHaveBeenCalled();
  });

  it('aborts the whole cycle without reconciling when listarImoveis fails', async () => {
    await db.productPage.create({ data: { codigo: 'existing', url: 'https://example.com/existing' } });
    vi.mocked(listarImoveis).mockRejectedValue(new Error('HTTP 500'));

    await crawlProductPages();

    expect(await db.productPage.findUnique({ where: { codigo: 'existing' } })).not.toBeNull();
    expect(gerarLinksImoveis).not.toHaveBeenCalled();
  });
});
