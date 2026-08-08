import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';
import { LiveEventSchema, type LiveEvent } from '../src/domain/models.js';

/** No upstreams, so the socket reports an offline server without any network. */
function config(extra: NodeJS.ProcessEnv = {}): Config {
  return loadConfig({ LOG_LEVEL: 'fatal', HOST: '127.0.0.1', ...extra });
}

/** Starts the app on a free port and returns the socket URL. */
async function serve(app: FastifyInstance): Promise<string> {
  await app.listen({ host: '127.0.0.1', port: 0 });

  const address = app.server.address();
  if (address === null || typeof address === 'string') throw new Error('not listening');

  return `ws://127.0.0.1:${address.port}/api/v1/live`;
}

/**
 * A connected client that queues what it is sent.
 *
 * The server pushes the server state as soon as the socket opens. A test that
 * awaits the open event attaches its message listener after that. Without a
 * queue, the first frame reaches nobody and is lost.
 */
interface Client {
  readonly socket: WebSocket;
  /** The next event not yet taken, validated against the shared schema. */
  next(): Promise<LiveEvent>;
  close(): Promise<void>;
}

function connect(url: string): Promise<Client> {
  const queued: LiveEvent[] = [];
  let waiting: ((event: LiveEvent) => void) | null = null;

  const socket = new WebSocket(url);

  socket.on('message', (raw: Buffer) => {
    const event = LiveEventSchema.parse(JSON.parse(raw.toString('utf8')));

    if (waiting !== null) {
      const resolve = waiting;
      waiting = null;
      resolve(event);
    } else {
      queued.push(event);
    }
  });

  const client: Client = {
    socket,
    next: () =>
      new Promise((resolve) => {
        const event = queued.shift();

        if (event === undefined) {
          waiting = resolve;
        } else {
          resolve(event);
        }
      }),
    close: () =>
      new Promise((resolve) => {
        socket.once('close', () => resolve());
        socket.close();
      }),
  };

  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(client));
    socket.once('error', reject);
  });
}

describe('live socket', () => {
  let app: FastifyInstance;
  let url: string;

  beforeAll(async () => {
    app = await buildApp(config());
    url = await serve(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends the server state on connect', async () => {
    const client = await connect(url);

    expect(await client.next()).toMatchObject({ type: 'server', server: { online: false } });

    await client.close();
  });

  it('answers an unrecognized command without closing', async () => {
    const client = await connect(url);
    await client.next();

    client.socket.send(JSON.stringify({ type: 'nonsense' }));

    expect(await client.next()).toEqual({ type: 'error', message: 'Unrecognized command' });
    expect(client.socket.readyState).toBe(WebSocket.OPEN);

    await client.close();
  });

  it('answers malformed JSON without closing', async () => {
    const client = await connect(url);
    await client.next();

    client.socket.send('{not json');

    expect(await client.next()).toEqual({ type: 'error', message: 'Unrecognized command' });

    await client.close();
  });

  it('reports a player it cannot resolve', async () => {
    const client = await connect(url);
    await client.next();

    client.socket.send(JSON.stringify({ type: 'watch', player: 'nobody' }));

    expect(await client.next()).toMatchObject({ type: 'error' });

    await client.close();
  });
});

describe('live socket connection limit', () => {
  let app: FastifyInstance;
  let url: string;

  beforeAll(async () => {
    app = await buildApp(config({ LIVE_MAX_CLIENTS: '1' }));
    url = await serve(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('turns a listener away with 1013 once the limit is reached', async () => {
    const held = await connect(url);

    const code = await new Promise<number>((resolve, reject) => {
      const extra = new WebSocket(url);
      extra.once('close', resolve);
      extra.once('error', reject);
    });

    expect(code).toBe(1013);

    await held.close();
  });
});
