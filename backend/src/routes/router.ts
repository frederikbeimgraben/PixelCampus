import { ORPCError, implement } from '@orpc/server';
import {
  contract,
  type Health,
  type Leaderboard,
  type PlayerProfile,
  type ServerInfo,
} from '../contract/index.js';

import type { ServerTapAdapter } from '../adapters/servertap.js';
import type { Config } from '../config.js';
import { offlineServer } from '../domain/live-hub.js';
import type { StatsService } from '../domain/stats-service.js';
import { ApiError, NotFoundError, UpstreamError } from '../lib/errors.js';

/** Per-request context the handlers receive. */
export interface RouterContext {
  readonly log: { warn: (details: unknown, message: string) => void };
}

export interface RouterDeps {
  readonly config: Config;
  readonly stats: StatsService;
  readonly serverTap: ServerTapAdapter;
}

/**
 * Implements the shared contract.
 *
 * `implement(contract)` ties each handler to its declared input and output, so
 * a handler returning the wrong shape is a compile error rather than something
 * the front end discovers at run time.
 */
export function buildRouter(deps: RouterDeps) {
  const base = implement(contract).$context<RouterContext>();

  /*
   * Domain errors carry the status the client should see, but oRPC wraps
   * anything it does not recognise as a 500. Without this, asking for a player
   * who does not exist answered "Internal server error".
   */
  const os = base.use(async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof ApiError) {
        throw new ORPCError(codeFor(error), { message: error.message, cause: error });
      }
      throw error;
    }
  });

  const health = os.health.handler((): Health => ({
    status: 'ok',
    upstreams: {
      serverTap: deps.config.serverTapConfigured,
      plan: deps.config.planConfigured,
    },
  }));

  const server = os.server.handler(async ({ context }): Promise<ServerInfo> => {
    if (!deps.serverTap.configured) {
      return offlineServer();
    }

    try {
      return await deps.serverTap.server();
    } catch (error) {
      // A stopped game server is an expected state, not a failure of this API.
      if (error instanceof UpstreamError) {
        context.log.warn({ err: error }, 'ServerTap unavailable');
        return offlineServer();
      }
      throw error;
    }
  });

  const leaderboard = os.leaderboard.handler(({ input }): Promise<Leaderboard> =>
    deps.stats.leaderboard(input.metric, input.limit, input.offset),
  );

  const player = os.player.handler(({ input }): Promise<PlayerProfile> =>
    deps.stats.player(input.player),
  );

  return os.router({ health, server, leaderboard, player });
}

/** Maps a domain error onto the oRPC code with the matching status. */
function codeFor(error: ApiError): 'NOT_FOUND' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_SERVER_ERROR' {
  if (error instanceof NotFoundError) return 'NOT_FOUND';
  if (error instanceof UpstreamError) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_SERVER_ERROR';
}
