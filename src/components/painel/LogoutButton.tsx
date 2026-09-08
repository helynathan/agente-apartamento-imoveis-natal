'use client';

import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full rounded-xl border border-nathai-mist px-3 py-2 text-sm text-nathai-ink/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-nathai-blue/30 hover:bg-nathai-paper hover:text-nathai-blue"
    >
      Sair
    </button>
  );
}
