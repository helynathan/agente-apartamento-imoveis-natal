'use client';

import { useRealtimeRefresh } from '@/lib/realtime/useRealtimeRefresh';

export function RealtimeRefresher({ eventTypes }: { eventTypes: string[] }) {
  useRealtimeRefresh(eventTypes);
  return null;
}
