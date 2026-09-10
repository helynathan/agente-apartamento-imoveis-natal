export interface NavLink {
  href: string;
  label: string;
}

const BASE_LINKS: NavLink[] = [{ href: '/painel', label: 'Fila de Atendimento' }];

const ADMIN_LINKS: NavLink[] = [
  { href: '/painel/admin/setores', label: 'Setores' },
  { href: '/painel/admin/usuarios', label: 'Usuários' },
  { href: '/painel/admin/produtos', label: 'Produtos' },
  { href: '/painel/admin/posts', label: 'Posts com Imóvel' },
];

export function getNavLinks(role: string): NavLink[] {
  return role === 'ADMIN' ? [...BASE_LINKS, ...ADMIN_LINKS] : [...BASE_LINKS];
}
