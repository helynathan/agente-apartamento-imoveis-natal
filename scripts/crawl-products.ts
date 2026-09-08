import { crawlProductPages } from '@/lib/products/crawlProductPages';

const INTERVAL_MS = 24 * 60 * 60 * 1000;

async function tick() {
  try {
    await crawlProductPages();
  } catch (error) {
    console.error('crawl-products tick failed', error);
  }
}

console.log(`Product crawler started, polling every ${INTERVAL_MS}ms`);
tick();
setInterval(tick, INTERVAL_MS);
