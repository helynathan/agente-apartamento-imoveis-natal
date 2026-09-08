'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useRealtimeRefresh(eventTypes: string[]): void {
  const router = useRouter();
  const reconnectAttempt = useRef(0);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_WS_URL;
    if (!url) return;

    let socket: WebSocket;
    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    function connect() {
      socket = new WebSocket(url as string);

      socket.onopen = () => {
        if (reconnectAttempt.current > 0) {
          router.refresh();
        }
        reconnectAttempt.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (eventTypes.includes(data.type)) {
            router.refresh();
          }
        } catch {
          // evento malformado, ignora
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current += 1;
        timeoutId = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      socket?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, eventTypes.join(',')]);
}
