import { createServer, type Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

export interface RealtimeServer {
  server: Server;
  wss: WebSocketServer;
  broadcast: (message: string) => void;
}

export function createRealtimeServer(): RealtimeServer {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/broadcast') {
      const secret = process.env.REALTIME_SECRET;
      const providedSecret = req.headers['x-realtime-secret'];

      if (!secret || providedSecret !== secret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unauthorized' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        broadcast(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcast(message: string) {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.warn('Failed to send to a realtime client', error);
        }
      }
    }
  }

  return { server, wss, broadcast };
}
