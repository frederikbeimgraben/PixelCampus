import { oc } from '@orpc/contract';
import { z } from 'zod';

import {
  HealthSchema,
  LeaderboardSchema,
  MetricSchema,
  PlayerProfileSchema,
  ServerInfoSchema,
} from './models.js';

/**
 * The API surface, described once.
 *
 * The back end implements this contract and the front end calls it. A path,
 * its inputs and its response shape cannot drift apart. A change here fails to
 * compile on the side that has not followed.
 *
 * The paths are REST paths, not an RPC envelope. curl reads them and nginx
 * caches them.
 */
export const contract = {
  health: oc
    .route({ method: 'GET', path: '/health', summary: 'Liveness and upstream availability' })
    .output(HealthSchema),

  server: oc
    .route({ method: 'GET', path: '/server', summary: 'Server name, version and player counts' })
    .output(ServerInfoSchema),

  leaderboard: oc
    .route({ method: 'GET', path: '/leaderboard', summary: 'Players ranked by a metric' })
    .input(
      z.object({
        metric: MetricSchema.default('playtime'),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        offset: z.coerce.number().int().min(0).max(10_000).default(0),
      }),
    )
    .output(LeaderboardSchema),

  player: oc
    .route({ method: 'GET', path: '/players/{player}', summary: 'One player profile' })
    .input(z.object({ player: z.string().min(1).max(64) }))
    .output(PlayerProfileSchema),
};

export type Contract = typeof contract;
