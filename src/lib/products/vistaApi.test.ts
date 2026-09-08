import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('vistaApi', () => {
  beforeEach(() => {
    vi.stubEnv('VISTA_API_KEY', 'test-key');
    vi.stubEnv('VISTA_CODIGO_USUARIO', '28');
    vi.stubEnv('VISTA_CODIGO_IMOBILIARIA', '11');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('listarImoveis', () => {
    it('requests the given page and parses listings, ignoring summary keys', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          '10001': { Codigo: '10001', Categoria: 'Apartamento', Bairro: 'Petrópolis', Cidade: 'Natal' },
          total: 1,
          paginas: 3,
          pagina: 1,
          quantidade: 50,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const { listarImoveis } = await import('@/lib/products/vistaApi');
      const result = await listarImoveis(1, 50);

      expect(result.totalPaginas).toBe(3);
      expect(result.imoveis).toEqual([
        { Codigo: '10001', Categoria: 'Apartamento', Bairro: 'Petrópolis', Cidade: 'Natal' },
      ]);

      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain('https://bless418-rest.vistahost.com.br/imoveis/listar');
      expect(calledUrl).toContain('key=test-key');
      expect(calledUrl).toContain('showtotal=1');
      expect(decodeURIComponent(calledUrl)).toContain('"pagina":1');
      expect(decodeURIComponent(calledUrl)).toContain('"quantidade":50');
    });

    it('throws when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const { listarImoveis } = await import('@/lib/products/vistaApi');
      await expect(listarImoveis(1, 50)).rejects.toThrow('HTTP 500');
    });

    it('throws when VISTA_API_KEY is missing', async () => {
      vi.stubEnv('VISTA_API_KEY', '');
      const { listarImoveis } = await import('@/lib/products/vistaApi');
      await expect(listarImoveis(1, 50)).rejects.toThrow('VISTA_API_KEY');
    });
  });

  describe('gerarLinksImoveis', () => {
    it('returns [] without calling fetch when codigos is empty', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const { gerarLinksImoveis } = await import('@/lib/products/vistaApi');
      const result = await gerarLinksImoveis([]);

      expect(result).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts a batch request and maps the response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ codigo: 10001, imobiliaria: 11, url: 'https://example.com/imovel/10001', short_url: false }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const { gerarLinksImoveis } = await import('@/lib/products/vistaApi');
      const result = await gerarLinksImoveis(['10001']);

      expect(result).toEqual([{ codigo: '10001', url: 'https://example.com/imovel/10001' }]);

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('https://bless418-rest.vistahost.com.br/imoveis/link?key=test-key');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body).toEqual({
        codigo_usuario: 28,
        encurtar: false,
        imoveis: [{ codigo: 10001, imobiliaria: 11 }],
      });
    });

    it('throws when the response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

      const { gerarLinksImoveis } = await import('@/lib/products/vistaApi');
      await expect(gerarLinksImoveis(['10001'])).rejects.toThrow('HTTP 400');
    });

    it('throws a clear error when VISTA_CODIGO_USUARIO is not numeric', async () => {
      vi.stubEnv('VISTA_CODIGO_USUARIO', 'changeme');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const { gerarLinksImoveis } = await import('@/lib/products/vistaApi');
      await expect(gerarLinksImoveis(['10001'])).rejects.toThrow(
        'VISTA_CODIGO_USUARIO must be a number, got "changeme"'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws a clear error when VISTA_CODIGO_IMOBILIARIA is not numeric', async () => {
      vi.stubEnv('VISTA_CODIGO_IMOBILIARIA', 'changeme');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const { gerarLinksImoveis } = await import('@/lib/products/vistaApi');
      await expect(gerarLinksImoveis(['10001'])).rejects.toThrow(
        'VISTA_CODIGO_IMOBILIARIA must be a number, got "changeme"'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
