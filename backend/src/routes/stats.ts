import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SkinAdapter } from '../adapters/skins.js';
import type { Config } from '../config.js';
import { LEADERBOARD_METRICS, type LeaderboardMetric } from '../domain/models.js';
import type { StatsService } from '../domain/stats-service.js';
import { NotFoundError } from '../lib/errors.js';

const leaderboardQuery = z.object({
  metric: z.enum(LEADERBOARD_METRICS as [LeaderboardMetric, ...LeaderboardMetric[]]).default('playtime'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

const playerParams = z.object({
  player: z.string().min(1).max(64),
});

// Restricting the UUID shape keeps a caller from steering the proxy at an
// arbitrary path on the render host.
const skinParams = z.object({
  uuid: z.string().regex(/^[0-9a-fA-F-]{32,36}$/),
  view: z.enum(['head', 'body', 'texture']),
});

const skinQuery = z.object({
  size: z.coerce.number().int().min(16).max(512).default(128),
});

export interface StatsRouteOptions {
  readonly config: Config;
  readonly stats: StatsService;
  readonly skins: SkinAdapter;
}

export async function statsRoutes(
  app: FastifyInstance,
  options: StatsRouteOptions,
): Promise<void> {
  const { config, stats, skins } = options;

  app.get('/api/v1/leaderboard', async (request, reply) => {
    const query = leaderboardQuery.parse(request.query);
    const board = await stats.leaderboard(query.metric, query.limit, query.offset);

    reply.header('cache-control', `public, max-age=${config.CACHE_TTL_SECONDS}`);
    return board;
  });

  app.get('/api/v1/players/:player', async (request, reply) => {
    const params = playerParams.parse(request.params);
    const profile = await stats.player(params.player);

    reply.header('cache-control', `public, max-age=${config.CACHE_TTL_SECONDS}`);
    return profile;
  });

  app.get('/api/v1/players/:uuid/skin/:view', async (request, reply) => {
    const params = skinParams.parse(request.params);
    const query = skinQuery.parse(request.query);

    const image = await skins.render(params.uuid, params.view, query.size);
    if (image === null) {
      throw new NotFoundError('No skin for that UUID');
    }

    reply.header('content-type', image.contentType);
    reply.header('cache-control', `public, max-age=${config.SKIN_CACHE_TTL_SECONDS}, immutable`);
    return reply.send(image.body);
  });
}
