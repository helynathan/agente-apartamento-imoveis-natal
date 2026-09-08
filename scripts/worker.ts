import { processNextOutboundMessage } from '@/lib/queue/outboundWorker';

const INTERVAL_MS = 15_000;

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await processNextOutboundMessage();
  } catch (error) {
    console.error('outbound worker tick failed', error);
  } finally {
    running = false;
  }
}

console.log(`Outbound worker started, polling every ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
