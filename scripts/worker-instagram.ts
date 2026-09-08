import { processNextInstagramOutboundMessage } from '@/lib/queue/outboundWorkerInstagram';

const INTERVAL_MS = 15_000;

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await processNextInstagramOutboundMessage();
  } catch (error) {
    console.error('instagram outbound worker tick failed', error);
  } finally {
    running = false;
  }
}

console.log(`Instagram outbound worker started, polling every ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
