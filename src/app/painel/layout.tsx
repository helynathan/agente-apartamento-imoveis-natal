import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';
import { authOptions } from '@/lib/auth/authOptions';
import { Sidebar } from '@/components/painel/Sidebar';

const display = Sora({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });
const technical = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-technical' });

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div
      className={`${display.variable} ${body.variable} ${technical.variable} font-body flex min-h-screen flex-col bg-nathai-paper md:flex-row`}
    >
      <Sidebar role={session.user.role} userName={session.user.name ?? session.user.email ?? 'Usuário'} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
