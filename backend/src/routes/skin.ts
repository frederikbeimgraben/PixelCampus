import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { DEGRADED_TTL_MS, type SkinAdapter } from '../adapters/skins.js';
import type { Config } from '../config.js';
import { NotFoundError } from '../lib/errors.js';

// The UUID shape is restricted so that a caller cannot point the proxy at an
// arbitrary path on the render host.
const skinParams = z.object({
  uuid: z.string().regex(/^[0-9a-fA-F-]{32,36}$/),
  view: z.enum(['head', 'body', 'texture']),
});

const skinQuery = z.object({
  size: z.coerce.number().int().min(16).max(512).default(128),
});

export interface SkinRouteOptions {
  readonly config: Config;
  readonly skins: SkinAdapter;
}

/**
 * Skin images.
 *
 * These stay out of the shared contract. They are binary responses with their
 * own caching, and the contract describes the JSON API.
 */
export async function skinRoutes(app: FastifyInstance, options: SkinRouteOptions): Promise<void> {
  const { config, skins } = options;

  app.get('/api/v1/players/:uuid/skin/:view', async (request, reply) => {
    const params = skinParams.parse(request.params);
    const query = skinQuery.parse(request.query);

    const image = await skins.render(params.uuid, params.view, query.size);
    if (image === null) {
      throw new NotFoundError('No skin for that UUID');
    }

    reply.header('content-type', image.contentType);

    // A good render never changes, so the browser may keep it and never ask
    // again. An image that the render service sent with an error status is kept
    // for a minute, or the browser holds it long after the service recovers.
    reply.header(
      'cache-control',
      image.degraded
        ? `public, max-age=${Math.round(DEGRADED_TTL_MS / 1000)}`
        : `public, max-age=${config.SKIN_CACHE_TTL_SECONDS}, immutable`,
    );
    return reply.send(image.body);
  });
}
