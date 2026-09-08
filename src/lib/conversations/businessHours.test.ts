import { describe, it, expect } from 'vitest';
import { businessMinutesSince } from './businessHours';

describe('businessMinutesSince', () => {
  it('counts the full gap within the same business day', () => {
    // Monday 2026-09-07, 10:00 -> 10:30 local (UTC 13:00 -> 13:30)
    const from = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 13, 30, 0));

    expect(businessMinutesSince(from, now)).toBe(30);
  });

  it('stops counting at the end of Friday and resumes at Saturday opening', () => {
    // Friday 2026-09-04, 17:50 local (UTC 20:50) -> Saturday 2026-09-05, 08:05 local (UTC 11:05)
    // 10 min (17:50-18:00 Fri) + 5 min (08:00-08:05 Sat) = 15
    const from = new Date(Date.UTC(2026, 8, 4, 20, 50, 0));
    const now = new Date(Date.UTC(2026, 8, 5, 11, 5, 0));

    expect(businessMinutesSince(from, now)).toBe(15);
  });

  it('stops counting at Saturday noon even if "now" is later that same Saturday', () => {
    // Saturday 2026-09-05, 08:00 local (UTC 11:00) -> 14:00 local (UTC 17:00)
    // window is 08:00-12:00, so only 240 minutes count
    const from = new Date(Date.UTC(2026, 8, 5, 11, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 5, 17, 0, 0));

    expect(businessMinutesSince(from, now)).toBe(240);
  });

  it('never counts any time on Sunday', () => {
    // Saturday 2026-09-05, 11:00 local (UTC 14:00) -> Sunday 2026-09-06, 15:00 local (UTC 18:00)
    // only 60 min count: 11:00-12:00 Saturday (window closes at noon); nothing on Sunday
    const from = new Date(Date.UTC(2026, 8, 5, 14, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 6, 18, 0, 0));

    expect(businessMinutesSince(from, now)).toBe(60);
  });

  it('sums correctly across a full weekend span', () => {
    // Friday 2026-09-04, 17:00 local (UTC 20:00) -> Monday 2026-09-07, 09:00 local (UTC 12:00)
    // Fri 17:00-18:00 = 60, Sat 08:00-12:00 = 240, Sun = 0, Mon 08:00-09:00 = 60 -> 360
    const from = new Date(Date.UTC(2026, 8, 4, 20, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 12, 0, 0));

    expect(businessMinutesSince(from, now)).toBe(360);
  });

  it('returns 0 when now is before or equal to from', () => {
    // Monday 2026-09-07, 10:00 local (UTC 13:00) -> 09:00 local (UTC 12:00) — now is earlier
    const from = new Date(Date.UTC(2026, 8, 7, 13, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 7, 12, 0, 0));

    expect(businessMinutesSince(from, now)).toBe(0);
  });
});
