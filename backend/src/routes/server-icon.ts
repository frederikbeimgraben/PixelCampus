import type { FastifyInstance } from 'fastify';

import type { PingAdapter } from '../adapters/ping.js';
import { NotConfiguredError, NotFoundError, UpstreamError } from '../lib/errors.js';

/**
 * How long a browser may keep the icon, in seconds.
 *
 * An operator changes the icon rarely, and a changed icon may take this long to
 * show. It is not immutable like a skin render: the URL stays the same when the
 * picture changes.
 */
const ICON_MAX_AGE_SECONDS = 3600;

export interface ServerIconRouteOptions {
  readonly ping: PingAdapter;
}

/**
 * The server icon, as the server list ping carries it.
 *
 * This stays out of the shared contract for the reason the skin images do: it
 * is a binary response with its own caching, and the contract describes the
 * JSON API. The ping is the one the status uses, so a page that shows both
 * costs the game server one ping at most.
 */
export async function serverIconRoutes(
  app: FastifyInstance,
  options: ServerIconRouteOptions,
): Promise<void> {
  const { ping } = options;

  app.get('/api/v1/server/icon.png', async (_request, reply) => {
    let icon: Buffer | null;

    try {
      icon = await ping.icon();
    } catch (error) {
      // A stopped server has no icon to give. The banner then draws its own
      // fallback, as it does for a server that sets none.
      if (error instanceof UpstreamError || error instanceof NotConfiguredError) {
        throw new NotFoundError('The server sends no icon right now');
      }
      throw error;
    }

    if (icon === null) {
      throw new NotFoundError('The server sends no icon');
    }

    reply.header('content-type', 'image/png');
    reply.header('cache-control', `public, max-age=${ICON_MAX_AGE_SECONDS}`);
    return reply.send(icon);
  });
}
