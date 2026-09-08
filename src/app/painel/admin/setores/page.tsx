import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';
import { listSectors } from '@/lib/sectors/sectorRepository';
import { createSectorAction } from './actions';

export default async function SetoresPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    redirect('/painel');
  }

  const sectors = await listSectors();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-6 text-xl font-bold text-nathai-ink">Setores</h1>
      <form action={createSectorAction} className="mb-8 flex gap-2">
        <input
          name="name"
          required
          placeholder="Nome do setor"
          className="flex-1 rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan px-4 py-2 font-display text-sm font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
        >
          Adicionar
        </button>
      </form>
      <ul className="divide-y divide-nathai-mist rounded-2xl border border-nathai-mist bg-white shadow-card">
        {sectors.map((sector) => (
          <li key={sector.id} className="px-4 py-2 text-nathai-ink">
            {sector.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
