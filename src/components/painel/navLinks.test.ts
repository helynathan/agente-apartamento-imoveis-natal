import { describe, it, expect } from 'vitest';
import { getNavLinks } from '@/components/painel/navLinks';

describe('getNavLinks', () => {
  it('returns only the queue link for AGENT role', () => {
    expect(getNavLinks('AGENT')).toEqual([{ href: '/painel', label: 'Fila de Atendimento' }]);
  });

  it('returns the queue link plus admin links for ADMIN role', () => {
    expect(getNavLinks('ADMIN')).toEqual([
      { href: '/painel', label: 'Fila de Atendimento' },
      { href: '/painel/admin/setores', label: 'Setores' },
      { href: '/painel/admin/usuarios', label: 'Usuários' },
      { href: '/painel/admin/produtos', label: 'Produtos' },
    ]);
  });

  it('returns only the queue link for any role other than ADMIN', () => {
    expect(getNavLinks('SOMETHING_ELSE')).toEqual([{ href: '/painel', label: 'Fila de Atendimento' }]);
  });
});
