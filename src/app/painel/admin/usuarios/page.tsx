import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';
import { listUsers } from '@/lib/users/userRepository';
import { createUserAction, updateUserAction } from './actions';

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    redirect('/painel');
  }

  const users = await listUsers();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-6 text-xl font-bold text-nathai-ink">Usuários</h1>
      <form action={createUserAction} className="mb-8 space-y-3 rounded-2xl border border-nathai-mist bg-white p-4 shadow-card">
        <input
          name="name"
          required
          placeholder="Nome"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <input
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="\d{10,13}"
          title="Somente números, com DDI e DDD (ex: 5511988887777)"
          placeholder="Telefone (WhatsApp, opcional — recebe alertas de SLA se for Admin)"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Senha"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <select
          name="role"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 text-nathai-ink outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        >
          <option value="AGENT">Atendente</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan px-4 py-2 font-display text-sm font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
        >
          Criar usuário
        </button>
      </form>
      <ul className="divide-y divide-nathai-mist rounded-2xl border border-nathai-mist bg-white shadow-card">
        {users.map((user) => (
          <li key={user.id} className="p-4">
            <form action={updateUserAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={user.id} />
              <input
                name="name"
                required
                defaultValue={user.name}
                placeholder="Nome"
                className="min-w-0 flex-1 rounded-lg border border-nathai-mist px-2 py-1 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              />
              <input
                name="email"
                type="email"
                required
                defaultValue={user.email}
                placeholder="Email"
                className="min-w-0 flex-1 rounded-lg border border-nathai-mist px-2 py-1 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              />
              <input
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="\d{10,13}"
                title="Somente números, com DDI e DDD (ex: 5511988887777)"
                defaultValue={user.phone ?? ''}
                placeholder="Telefone (WhatsApp)"
                className="min-w-0 flex-1 rounded-lg border border-nathai-mist px-2 py-1 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              />
              <select
                name="role"
                defaultValue={user.role}
                className="rounded-lg border border-nathai-mist px-2 py-1 text-sm text-nathai-ink outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              >
                <option value="AGENT">Atendente</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-nathai-blue to-nathai-cyan px-3 py-1 font-display text-sm font-medium text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
              >
                Salvar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
