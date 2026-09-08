import { listSectors } from '@/lib/sectors/sectorRepository';
import { getKanbanColumns } from '@/lib/conversations/kanbanBoard';
import { KanbanBoard } from '@/components/painel/KanbanBoard';
import { RealtimeRefresher } from '@/lib/realtime/RealtimeRefresher';

export default async function PainelPage() {
  const [columns, sectors] = await Promise.all([getKanbanColumns(), listSectors()]);

  return (
    <main className="p-8">
      <RealtimeRefresher eventTypes={['queue:updated', 'conversation:updated', 'message:new']} />
      <h1 className="font-display mb-6 text-xl font-medium text-nathai-ink">Fila de atendimento</h1>
      <KanbanBoard columns={columns} sectors={sectors} />
    </main>
  );
}
