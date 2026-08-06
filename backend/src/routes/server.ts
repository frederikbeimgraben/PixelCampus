import type { FastifyInstance } from 'fastify';

import type { ServerTapAdapter } from '../adapters/servertap.js';
import type { Config } from '../config.js';
import { UpstreamError } from '../lib/errors.js';

export interface ServerRouteOptions {
  readonly config: Config;
  readonly serverTap: ServerTapAdapter;
}

export async function serverRoutes(
  app: FastifyInstance,
  options: ServerRouteOptions,
): Promise<void> {
  const { config, serverTap } = options;

  app.get('/health', async () => ({
    status: 'ok',
    upstreams: {
      serverTap: config.serverTapConfigured,
      plan: config.planConfigured,
    },
  }));

  app.get('/api/v1/server', async (request, reply) => {
    reply.header('cache-control', 'public, max-age=15');

    if (!serverTap.configured) {
      return offline();
    }

    try {
      return await serverTap.server();
    } catch (error) {
      // A stopped game server is an expected state, not a failure of this API.
      if (error instanceof UpstreamError) {
        request.log.warn({ err: error }, 'ServerTap unavailable');
        return offline();
      }
      throw error;
    }
  });
}

function offline() {
  return {
    name: 'PixelCampus',
    motd: '',
    version: 'unknown',
    online: false,
    playerCount: 0,
    maxPlayerCount: 0,
    players: [],
  };
}
