import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/** Config with no upstreams, which is how the service behaves when plugins are down. */
const bareConfig = loadConfig({
  LOG_LEVEL: 'fatal',
  CORS_ORIGINS: 'http://localhost:4200',
} as NodeJS.ProcessEnv);

describe('routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(bareConfig);
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports health and which upstreams are configured', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      upstreams: { serverTap: false, plan: false },
    });
  });

  it('reports the server as offline rather than failing when ServerTap is absent', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/server' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ online: false, playerCount: 0 });
  });

  it('returns an empty leaderboard when PLAN is absent', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ metric: 'playtime', entries: [], total: 0 });
  });

  it('defaults the metric and honours a valid one', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?metric=kills' });

    expect(response.statusCode).toBe(200);
    expect(response.json().metric).toBe('kills');
  });

  it('rejects an unknown metric', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?metric=bogus' });
    expect(response.statusCode).toBe(400);
  });

  it('rejects an out-of-range limit', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/leaderboard?limit=5000' });
    expect(response.statusCode).toBe(400);
  });

  it('404s a player neither upstream knows', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/players/nobody' });
    expect(response.statusCode).toBe(404);
  });

  it('rejects a skin uuid that is not a uuid', async () => {
    // Guards the proxy against being pointed at an arbitrary upstream path.
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/players/..%2F..%2Fetc/skin/head',
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects an unknown skin view', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/players/069a79f4-44e9-4726-a5be-fca90e38aaf5/skin/torso',
    });

    expect(response.statusCode).toBe(400);
  });

  it('404s an unknown path', async () => {
    const response = await app.inject({ method: 'GET', url: '/nope' });
    expect(response.statusCode).toBe(404);
  });
});
