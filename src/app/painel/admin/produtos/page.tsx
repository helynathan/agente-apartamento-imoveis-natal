import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';
import { getProductSyncStatus } from '@/lib/products/productPageRepository';

export default async function ProdutosPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    redirect('/painel');
  }

  const status = await getProductSyncStatus();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-6 text-xl font-bold text-nathai-ink">Produtos (sincronização com o Vista)</h1>
      <p className="mb-4 text-sm text-nathai-ink/60">
        Os imóveis são sincronizados automaticamente a partir do CRM Vista/LOFT. Não é possível cadastrar
        imóveis manualmente aqui.
      </p>
      <dl className="grid grid-cols-1 gap-4 rounded-2xl border border-nathai-mist bg-white p-6 shadow-card sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-nathai-ink/50">Imóveis sincronizados</dt>
          <dd className="font-display text-2xl text-nathai-ink">{status.totalImoveis}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-nathai-ink/50">Última sincronização</dt>
          <dd className="font-mono text-sm text-nathai-ink">
            {status.lastSyncedAt ? status.lastSyncedAt.toLocaleString('pt-BR') : 'Ainda não sincronizado'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-nathai-ink/50">Imóveis com erro</dt>
          <dd className="font-display text-2xl text-nathai-ink">{status.errorCount}</dd>
        </div>
      </dl>
    </main>
  );
}
