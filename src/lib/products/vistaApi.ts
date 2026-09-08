const VISTA_BASE_URL = 'https://bless418-rest.vistahost.com.br';

const LISTAR_FIELDS = [
  'Codigo',
  'Categoria',
  'Bairro',
  'Cidade',
  'ValorVenda',
  'ValorLocacao',
  'Dormitorios',
  'Suites',
  'Vagas',
  'AreaTotal',
  'AreaPrivativa',
  'Caracteristicas',
  'InfraEstrutura',
];

const SUMMARY_KEYS = new Set(['total', 'paginas', 'pagina', 'quantidade']);

export interface VistaImovel {
  Codigo: string;
  Categoria: string;
  Bairro: string;
  Cidade: string;
  ValorVenda: string;
  ValorLocacao: string;
  Dormitorios: string;
  Suites: string;
  Vagas: string;
  AreaTotal: string;
  AreaPrivativa: string;
  Caracteristicas: Record<string, string>;
  InfraEstrutura: Record<string, string>;
}

export interface ListarImoveisResult {
  imoveis: VistaImovel[];
  totalPaginas: number;
}

export interface VistaLink {
  codigo: string;
  url: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function requireNumericEnv(name: string): number {
  const value = requireEnv(name);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, got "${value}"`);
  }
  return parsed;
}

export async function listarImoveis(pagina: number, quantidade: number): Promise<ListarImoveisResult> {
  const key = requireEnv('VISTA_API_KEY');
  const pesquisa = JSON.stringify({
    fields: LISTAR_FIELDS,
    paginacao: { pagina, quantidade },
  });

  const url = `${VISTA_BASE_URL}/imoveis/listar?key=${encodeURIComponent(key)}&showtotal=1&pesquisa=${encodeURIComponent(pesquisa)}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Vista imoveis/listar responded with HTTP ${response.status}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  const totalPaginas = typeof body.paginas === 'number' ? body.paginas : 1;

  const imoveis = Object.entries(body)
    .filter(([field, value]) => !SUMMARY_KEYS.has(field) && typeof value === 'object' && value !== null)
    .map(([, value]) => value as VistaImovel);

  return { imoveis, totalPaginas };
}

export async function gerarLinksImoveis(codigos: string[]): Promise<VistaLink[]> {
  if (codigos.length === 0) {
    return [];
  }

  const key = requireEnv('VISTA_API_KEY');
  const codigoUsuario = requireNumericEnv('VISTA_CODIGO_USUARIO');
  const imobiliaria = requireNumericEnv('VISTA_CODIGO_IMOBILIARIA');

  const response = await fetch(`${VISTA_BASE_URL}/imoveis/link?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      codigo_usuario: codigoUsuario,
      encurtar: false,
      imoveis: codigos.map((codigo) => ({ codigo: Number(codigo), imobiliaria })),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Vista imoveis/link responded with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { data: Array<{ codigo: number; url: string }> };
  return body.data.map((item) => ({ codigo: String(item.codigo), url: item.url }));
}
