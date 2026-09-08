const UTC_MINUS_3_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function businessWindowMinutes(localMidnightMs: number): { startMin: number; endMin: number } | null {
  const weekday = new Date(localMidnightMs).getUTCDay(); // 0=Sun ... 6=Sat, on the shifted "local" instant

  if (weekday === 0) return null; // Sunday: never counts
  if (weekday === 6) return { startMin: 8 * 60, endMin: 12 * 60 }; // Saturday 08:00-12:00
  return { startMin: 8 * 60, endMin: 18 * 60 }; // Monday-Friday 08:00-18:00
}

/**
 * Elapsed minutes between `from` and `now`, counting only minutes that fall
 * inside business hours (America/Sao_Paulo, fixed UTC-3, no DST): Mon-Fri
 * 08:00-18:00, Saturday 08:00-12:00, Sunday never counts.
 */
export function businessMinutesSince(from: Date, now: Date): number {
  if (now.getTime() <= from.getTime()) return 0;

  const localFromMs = from.getTime() - UTC_MINUS_3_OFFSET_MS;
  const localNowMs = now.getTime() - UTC_MINUS_3_OFFSET_MS;

  let totalMinutes = 0;
  let dayStartMs = Math.floor(localFromMs / DAY_MS) * DAY_MS;

  while (dayStartMs < localNowMs) {
    const window = businessWindowMinutes(dayStartMs);
    if (window) {
      const windowStartMs = dayStartMs + window.startMin * 60_000;
      const windowEndMs = dayStartMs + window.endMin * 60_000;
      const overlapStartMs = Math.max(windowStartMs, localFromMs);
      const overlapEndMs = Math.min(windowEndMs, localNowMs);
      if (overlapEndMs > overlapStartMs) {
        totalMinutes += (overlapEndMs - overlapStartMs) / 60_000;
      }
    }
    dayStartMs += DAY_MS;
  }

  return Math.floor(totalMinutes);
}
