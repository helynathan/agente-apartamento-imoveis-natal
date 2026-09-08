import { db } from '@/lib/db';
import { sendText } from '@/lib/evolutionApi';
import { findOverdueConversations } from '@/lib/conversations/findOverdueConversations';

export async function escalateOverdueConversations(now: Date = new Date()): Promise<{ escalated: number }> {
  const parsedSlaMinutes = Number(process.env.SLA_MINUTES);
  const slaMinutes = Number.isFinite(parsedSlaMinutes) && parsedSlaMinutes > 0 ? parsedSlaMinutes : 15;
  if (process.env.SLA_MINUTES && slaMinutes === 15 && parsedSlaMinutes !== 15) {
    console.warn('Invalid SLA_MINUTES env var, falling back to 15:', process.env.SLA_MINUTES);
  }
  const overdue = await findOverdueConversations(now, slaMinutes);

  if (overdue.length === 0) {
    return { escalated: 0 };
  }

  const admins = await db.user.findMany({
    where: { role: 'ADMIN', phone: { not: null } },
    select: { phone: true },
  });

  for (const conversation of overdue) {
    const label = conversation.customerName ?? conversation.customerExternalId;
    const text = `⚠️ SLA estourado: ${label} está aguardando atendimento há mais de ${slaMinutes} min.\n${process.env.NEXTAUTH_URL}/painel/conversas/${conversation.id}`;

    for (const admin of admins) {
      try {
        await sendText({ phone: admin.phone as string, text });
      } catch (error) {
        console.error('Failed to send SLA escalation to admin', admin.phone, error);
      }
    }

    await db.conversation.update({ where: { id: conversation.id }, data: { slaEscalatedAt: now } });
  }

  return { escalated: overdue.length };
}
