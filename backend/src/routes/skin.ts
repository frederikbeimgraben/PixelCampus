import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { SkinAdapter } from '../adapters/skins.js';
import type { Config } from '../config.js';
import { NotFoundError } from '../lib/errors.js';

// Restricting the UUID shape keeps a caller from steering the proxy at an
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
 * Kept out of the shared contract: these are binary responses with their own
 * caching, and the contract describes the JSON API.
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
    reply.header('cache-control', `public, max-age=${config.SKIN_CACHE_TTL_SECONDS}, immutable`);
    return reply.send(image.body);
  });
}
