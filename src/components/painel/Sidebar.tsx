'use client';

import { useState } from 'react';
import { SidebarNav } from './SidebarNav';
import { LogoutButton } from './LogoutButton';

export function Sidebar({ role, userName }: { role: string; userName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-nathai-mist bg-white/85 p-4 backdrop-blur-md md:hidden">
        <img src="/nathai-logo.png" alt="Nathai" className="h-8 w-auto" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-xl p-2 text-nathai-ink transition-all duration-200 hover:-translate-y-0.5 hover:bg-nathai-paper"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside
            onClick={() => setOpen(false)}
            className="relative flex h-full w-64 flex-col justify-between rounded-r-[20px] bg-white p-6 shadow-card-hover"
          >
            <div>
              <div className="mb-8 flex items-center justify-between">
                <img src="/nathai-logo.png" alt="Nathai" className="h-9 w-auto" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                  }}
                  aria-label="Fechar menu"
                  className="p-1 text-xl leading-none text-nathai-ink/60"
                >
                  ✕
                </button>
              </div>
              <SidebarNav role={role} />
            </div>
            <div className="flex flex-col gap-3 border-t border-nathai-mist pt-4">
              <span className="truncate text-sm text-nathai-ink/50">{userName}</span>
              <LogoutButton />
            </div>
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col justify-between border-r border-nathai-mist bg-white p-6 md:flex">
        <div>
          <img src="/nathai-logo.png" alt="Nathai" className="mb-8 h-9 w-auto" />
          <SidebarNav role={role} />
        </div>
        <div className="flex flex-col gap-3 border-t border-nathai-mist pt-4">
          <span className="truncate text-sm text-nathai-ink/50">{userName}</span>
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
