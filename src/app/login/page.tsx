'use client';

import { signIn } from 'next-auth/react';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';

const display = Sora({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const technical = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-technical' });

function NodeMark({ delay }: { delay: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-nathai-cyan motion-safe:animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}

function ConnectionPath() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      fill="none"
      className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-20 lg:h-96 lg:w-96"
    >
      <line x1="20" y1="180" x2="180" y2="20" stroke="#00C6F0" strokeWidth="1.5" strokeDasharray="2 6" strokeLinecap="round" />
      <circle cx="60" cy="140" r="5" fill="#00C6F0" className="motion-safe:animate-pulse" />
      <circle cx="100" cy="100" r="5" fill="#00C6F0" style={{ animationDelay: '0.4s' }} className="motion-safe:animate-pulse" />
      <circle cx="140" cy="60" r="5" fill="#00C6F0" style={{ animationDelay: '0.8s' }} className="motion-safe:animate-pulse" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    });

    if (result?.error) {
      setError('Email ou senha incorretos.');
      return;
    }

    router.push('/painel');
    router.refresh();
  }

  return (
    <main
      className={`${display.variable} ${body.variable} ${technical.variable} font-body flex min-h-screen flex-col bg-nathai-paper lg:flex-row`}
    >
      <section className="relative flex flex-col justify-between overflow-hidden bg-nathai-ink px-8 py-10 lg:w-1/2 lg:px-16 lg:py-16">
        <span className="font-display text-sm font-medium tracking-[0.3em] text-nathai-paper/60">NATHAI</span>

        <div className="my-10 lg:my-0">
          <h1 className="font-display max-w-md text-3xl font-extrabold leading-tight text-nathai-paper lg:text-4xl">
            Atendimento comercial que vende sozinho.
          </h1>
          <ul className="mt-8 space-y-3 text-sm text-nathai-paper/70">
            <li className="flex items-center gap-3">
              <NodeMark delay="0s" />
              IA triando conversas 24 horas por dia
            </li>
            <li className="flex items-center gap-3">
              <NodeMark delay="0.4s" />
              Fila organizada por setor, sem perder ninguém
            </li>
            <li className="flex items-center gap-3">
              <NodeMark delay="0.8s" />
              Leads sincronizados direto no CRM
            </li>
          </ul>
        </div>

        <p className="font-mono text-xs tracking-wide text-nathai-paper/40">WHATSAPP · IA · CRM</p>

        <ConnectionPath />
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <img src="/nathai-logo.png" alt="Nathai" className="mb-8 h-8 w-auto" />

          <h2 className="font-display text-2xl font-bold text-nathai-ink">Entrar</h2>
          <p className="mt-1 text-sm text-nathai-ink/50">Acesse o painel de atendimento.</p>

          {error && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <label className="mb-1 mt-6 block text-sm font-medium text-nathai-ink">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-xl border border-nathai-mist bg-white px-3 py-2 text-nathai-ink outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
          />

          <label className="mb-1 mt-4 block text-sm font-medium text-nathai-ink">Senha</label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-xl border border-nathai-mist bg-white px-3 py-2 text-nathai-ink outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
          />

          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan px-4 py-2.5 font-display font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover focus:outline-none focus:ring-2 focus:ring-nathai-blue/40 focus:ring-offset-2"
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
