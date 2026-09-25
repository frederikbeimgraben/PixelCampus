import { createServer, type AddressInfo, type Server } from 'node:net';

import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PingAdapter } from '../src/adapters/ping.js';
import { buildApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';

/** The eight bytes every PNG starts with, which is all the icon checks. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const STATUS = {
  version: { name: 'Paper 1.21.4', protocol: 769 },
  players: { max: 20, online: 1, sample: [{ name: 'Notch', id: 'u-1' }] },
  description: { text: '', extra: [{ text: 'Pixel', color: 'aqua' }] },
  favicon: `data:image/png;base64,${PNG.toString('base64')}`,
};

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value;

  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (rest !== 0);

  return Buffer.from(bytes);
}

/** The answer to a status request: frame length, packet id, then the JSON. */
function statusFrame(status: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(status), 'utf8');
  const body = Buffer.concat([varInt(0x00), varInt(json.length), json]);
  return Buffer.concat([varInt(body.length), body]);
}

/**
 * A game server that answers every status request with one status, and counts
 * how often it was asked.
 */
interface FakeServer {
  readonly port: number;
  status: unknown;
  pings: number;
  close(): Promise<void>;
}

async function fakeServer(status: unknown, port = 0): Promise<FakeServer> {
  const fake = { status, pings: 0 } as FakeServer;

  const server: Server = createServer((socket) => {
    socket.once('data', () => {
      fake.pings += 1;
      socket.end(statusFrame(fake.status));
    });
  });

  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

  return Object.assign(fake, {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
}

function configFor(port: number): Config {
  return loadConfig({
    LOG_LEVEL: 'fatal',
    MC_HOST: '127.0.0.1',
    MC_PORT: String(port),
    UPSTREAM_TIMEOUT_MS: '1000',
  } as NodeJS.ProcessEnv);
}

describe('PingAdapter', () => {
  let fake: FakeServer;

  beforeEach(async () => {
    fake = await fakeServer(STATUS);
  });

  afterEach(async () => {
    await fake.close();
  });

  it('serves the status and the icon from one ping', async () => {
    const adapter = new PingAdapter(configFor(fake.port));

    const [server, icon] = await Promise.all([adapter.server(), adapter.icon()]);
    await adapter.server();

    expect(server.description).toEqual(STATUS.description);
    expect(server.latencyMs).toBeGreaterThan(0);
    expect(icon?.equals(PNG)).toBe(true);
    expect(fake.pings).toBe(1);
  });

  it('pings again when asked for a fresh answer, and shares that one', async () => {
    const adapter = new PingAdapter(configFor(fake.port));
    await adapter.server();

    fake.status = { ...STATUS, players: { ...STATUS.players, online: 5 } };
    const fresh = await adapter.server({ fresh: true });
    const cached = await adapter.server();

    expect(fresh.playerCount).toBe(5);
    expect(cached.playerCount).toBe(5);
    expect(fake.pings).toBe(2);
  });

  it('keeps a failed ping for the TTL, so a stopped server costs one timeout', async () => {
    const port = fake.port;
    await fake.close();
    const adapter = new PingAdapter(configFor(port));

    await expect(adapter.server()).rejects.toThrow(/unreachable/);

    // The server is back, but the failure still answers until it expires.
    fake = await fakeServer(STATUS, port);
    await expect(adapter.icon()).rejects.toThrow(/unreachable/);
    expect(fake.pings).toBe(0);

    // The live socket asks for a fresh answer, and that one clears it.
    await expect(adapter.server({ fresh: true })).resolves.toMatchObject({ online: true });
    expect(fake.pings).toBe(1);
  });
});

describe('GET /api/v1/server/icon.png', () => {
  let fake: FakeServer;
  let app: FastifyInstance;

  beforeAll(async () => {
    fake = await fakeServer(STATUS);
    app = await buildApp(configFor(fake.port));
  });

  afterAll(async () => {
    await app.close();
    await fake.close();
  });

  it('serves the icon the server sends, as a PNG a browser may keep', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/server/icon.png' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toMatch(/^public, max-age=\d+$/);
    expect(response.rawPayload.equals(PNG)).toBe(true);
  });

  it('serves the MOTD tree and the latency beside it in the status', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/server' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      online: true,
      motd: 'Pixel',
      description: STATUS.description,
      latencyMs: expect.any(Number),
    });
  });
});

describe('GET /api/v1/server/icon.png without an icon', () => {
  it('404s when the server sets no icon', async () => {
    const { favicon: _omitted, ...withoutIcon } = STATUS;
    const fake = await fakeServer(withoutIcon);
    const app = await buildApp(configFor(fake.port));

    const response = await app.inject({ method: 'GET', url: '/api/v1/server/icon.png' });

    expect(response.statusCode).toBe(404);
    await app.close();
    await fake.close();
  });

  it('404s when no game server is configured', async () => {
    const app = await buildApp(loadConfig({ LOG_LEVEL: 'fatal' } as NodeJS.ProcessEnv));

    const response = await app.inject({ method: 'GET', url: '/api/v1/server/icon.png' });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('404s when the server does not answer', async () => {
    const fake = await fakeServer(STATUS);
    const port = fake.port;
    await fake.close();
    const app = await buildApp(configFor(port));

    const response = await app.inject({ method: 'GET', url: '/api/v1/server/icon.png' });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
