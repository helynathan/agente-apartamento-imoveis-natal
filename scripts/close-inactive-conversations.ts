import { closeInactiveConversations } from '@/lib/conversations/closeInactiveConversations';
import { broadcastEvent } from '@/lib/realtime/broadcast';

const INTERVAL_MS = 15 * 60 * 1000;

async function tick() {
  try {
    const result = await closeInactiveConversations();
    if (result.closed > 0) {
      await broadcastEvent({ type: 'queue:updated' });
      for (const conversationId of result.conversationIds) {
        await broadcastEvent({ type: 'conversation:updated', conversationId });
      }
    }
  } catch (error) {
    console.error('close-inactive-conversations tick failed', error);
  }
}

console.log(`Inactivity closer started, polling every ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
