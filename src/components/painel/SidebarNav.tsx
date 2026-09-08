'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getNavLinks } from './navLinks';

export function SidebarNav({ role }: { role: string }) {
  const pathname = usePathname();
  const links = getNavLinks(role);

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? 'rounded-xl bg-gradient-to-r from-nathai-blue/10 to-nathai-cyan/10 px-3 py-2 text-sm font-medium text-nathai-blue transition-all duration-200'
                : 'rounded-xl px-3 py-2 text-sm font-medium text-nathai-ink/70 transition-all duration-200 hover:translate-x-0.5 hover:bg-nathai-blue/10 hover:text-nathai-blue'
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
