import { db } from '@/lib/db';
import { requestEmbedding } from '@/lib/ai/requestEmbedding';
import { listarImoveis, gerarLinksImoveis, type VistaImovel } from '@/lib/products/vistaApi';

const PAGE_SIZE = 50;

function formatMoney(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildContent(imovel: VistaImovel): string {
  const parts: string[] = [`${imovel.Categoria} em ${imovel.Bairro}, ${imovel.Cidade}`];

  const details: string[] = [];
  if (Number(imovel.Dormitorios) > 0) details.push(`${imovel.Dormitorios} dormitórios`);
  if (Number(imovel.Suites) > 0) details.push(`${imovel.Suites} suítes`);
  if (Number(imovel.Vagas) > 0) details.push(`${imovel.Vagas} vagas`);
  if (Number(imovel.AreaTotal) > 0) details.push(`${imovel.AreaTotal}m²`);
  if (details.length > 0) parts.push(details.join(', '));

  if (Number(imovel.ValorVenda) > 0) parts.push(`Venda: ${formatMoney(imovel.ValorVenda)}`);
  if (Number(imovel.ValorLocacao) > 0) parts.push(`Locação: ${formatMoney(imovel.ValorLocacao)}`);

  const caracteristicas = Object.entries(imovel.Caracteristicas ?? {})
    .filter(([, value]) => value === 'Sim')
    .map(([key]) => key);
  if (caracteristicas.length > 0) parts.push(`Características: ${caracteristicas.join(', ')}`);

  return parts.join(' — ');
}

async function recordFailure(codigo: string, message: string, url?: string): Promise<void> {
  try {
    await db.productPage.upsert({
      where: { codigo },
      create: { codigo, url: url ?? `pending:${codigo}`, lastError: message },
      update: { lastError: message, ...(url ? { url } : {}) },
    });
  } catch (error) {
    console.error(`Failed to record failure for listing ${codigo}, continuing sync cycle`, error);
  }
}

async function recordSuccess(codigo: string, url: string, imovel: VistaImovel): Promise<void> {
  const content = buildContent(imovel);
  const embedding = await requestEmbedding(content.slice(0, 20_000));
  const vectorLiteral = `[${embedding.join(',')}]`;

  const record = await db.productPage.upsert({
    where: { codigo },
    create: { codigo, url },
    update: { url },
  });

  await db.$executeRaw`
    UPDATE "ProductPage"
    SET content = ${content}, embedding = ${vectorLiteral}::vector, "lastCrawledAt" = now(), "lastError" = NULL, "updatedAt" = now()
    WHERE id = ${record.id}
  `;
}

export async function crawlProductPages(): Promise<void> {
  const allImoveis: VistaImovel[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  try {
    do {
      const result = await listarImoveis(pagina, PAGE_SIZE);
      allImoveis.push(...result.imoveis);
      totalPaginas = result.totalPaginas;
      pagina += 1;
    } while (pagina <= totalPaginas);
  } catch (error) {
    console.error('Vista imoveis/listar failed, aborting this sync cycle without reconciling', error);
    return;
  }

  const seenCodigos: string[] = [];

  for (let i = 0; i < allImoveis.length; i += PAGE_SIZE) {
    const batch = allImoveis.slice(i, i + PAGE_SIZE);
    const codigos = batch.map((item) => item.Codigo);
    seenCodigos.push(...codigos);

    let linkByCodigo = new Map<string, string>();
    try {
      const links = await gerarLinksImoveis(codigos);
      linkByCodigo = new Map(links.map((link) => [link.codigo, link.url]));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const codigo of codigos) {
        await recordFailure(codigo, message);
      }
      continue;
    }

    for (const item of batch) {
      const url = linkByCodigo.get(item.Codigo);
      if (!url) {
        await recordFailure(item.Codigo, 'Link não gerado para este imóvel');
        continue;
      }

      try {
        await recordSuccess(item.Codigo, url, item);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordFailure(item.Codigo, message, url);
      }
    }
  }

  if (allImoveis.length === 0) {
    console.warn('Vista imoveis/listar returned zero listings, skipping reconciliation to avoid wiping ProductPage');
    return;
  }

  await db.productPage.deleteMany({ where: { codigo: { notIn: seenCodigos } } });
}
