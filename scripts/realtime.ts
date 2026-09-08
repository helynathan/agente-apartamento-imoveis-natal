import 'dotenv/config';
import { createRealtimeServer } from '@/lib/realtime/server';

const PORT = Number(process.env.REALTIME_PORT ?? 4001);

const { server } = createRealtimeServer();

server.listen(PORT, () => {
  console.log(`Realtime server listening on port ${PORT}`);
});
