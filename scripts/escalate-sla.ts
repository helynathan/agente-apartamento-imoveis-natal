import { escalateOverdueConversations } from '@/lib/conversations/escalateOverdueConversations';

const INTERVAL_MS = 15 * 60 * 1000;

async function tick() {
  try {
    await escalateOverdueConversations();
  } catch (error) {
    console.error('escalate-sla tick failed', error);
  }
}

console.log(`SLA escalation started, polling every ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
