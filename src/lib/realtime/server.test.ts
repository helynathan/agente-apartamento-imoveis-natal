import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createRealtimeServer } from '@/lib/realtime/server';

describe('createRealtimeServer', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.unstubAllEnvs();
  });

  it('broadcasts a message only to clients with an open connection', () => {
    const { wss, broadcast, server } = createRealtimeServer();
    cleanup = () => server.close();

    const openClient = { readyState: 1, send: vi.fn() };
    const closedClient = { readyState: 3, send: vi.fn() };
    wss.clients.add(openClient as unknown as never);
    wss.clients.add(closedClient as unknown as never);

    broadcast('hello');

    expect(openClient.send).toHaveBeenCalledWith('hello');
    expect(closedClient.send).not.toHaveBeenCalled();
  });

  it('does not abort the loop when one client send() throws synchronously', () => {
    const { wss, broadcast, server } = createRealtimeServer();
    cleanup = () => server.close();

    const throwingClient = {
      readyState: 1,
      send: vi.fn(() => {
        throw new Error('socket exploded');
      }),
    };
    const laterClient = { readyState: 1, send: vi.fn() };
    wss.clients.add(throwingClient as unknown as never);
    wss.clients.add(laterClient as unknown as never);

    expect(() => broadcast('hello')).not.toThrow();
    expect(laterClient.send).toHaveBeenCalledWith('hello');
  });

  it('accepts POST /broadcast and broadcasts when the shared secret header matches', async () => {
    vi.stubEnv('REALTIME_SECRET', 'test-secret');
    const { wss, server } = createRealtimeServer();
    cleanup = () => server.close();

    const client = { readyState: 1, send: vi.fn() };
    wss.clients.add(client as unknown as never);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const res = await fetch(`http://localhost:${port}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-realtime-secret': 'test-secret' },
      body: JSON.stringify({ type: 'queue:updated' }),
    });

    expect(res.status).toBe(200);
    expect(client.send).toHaveBeenCalledWith(JSON.stringify({ type: 'queue:updated' }));
  });

  it('rejects POST /broadcast with 401 and does not broadcast when the secret is wrong or missing', async () => {
    vi.stubEnv('REALTIME_SECRET', 'test-secret');
    const { wss, server } = createRealtimeServer();
    cleanup = () => server.close();

    const client = { readyState: 1, send: vi.fn() };
    wss.clients.add(client as unknown as never);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const wrongSecretRes = await fetch(`http://localhost:${port}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-realtime-secret': 'nope' },
      body: JSON.stringify({ type: 'queue:updated' }),
    });
    expect(wrongSecretRes.status).toBe(401);

    const missingSecretRes = await fetch(`http://localhost:${port}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'queue:updated' }),
    });
    expect(missingSecretRes.status).toBe(401);

    expect(client.send).not.toHaveBeenCalled();
  });
});
