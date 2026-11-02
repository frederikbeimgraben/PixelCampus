import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { BookStackAdapter } from '../adapters/bookstack.js';
import type { Config } from '../config.js';
import { isWikiImagePath } from '../domain/wiki-html.js';
import { NotFoundError } from '../lib/errors.js';

export interface WikiRouteOptions {
  readonly config: Config;
  readonly wiki: BookStackAdapter;
}

const hookQuery = z.object({ secret: z.string().max(512).default('') });

/**
 * The image proxy and the cache webhook of the wiki.
 *
 * These stay out of the shared contract, like the skin images: one answers
 * binary, the other is called by BookStack and not by the site.
 */
export async function wikiRoutes(app: FastifyInstance, options: WikiRouteOptions): Promise<void> {
  const { config, wiki } = options;

  // Not rate limited. One page can hold many images, and every image is
  // cached here for a day, so a request costs almost nothing.
  app.get('/api/v1/wiki/images/*', { config: { rateLimit: false } }, async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    if (!isWikiImagePath(path)) {
      throw new NotFoundError('No such wiki image');
    }

    const image = await wiki.image(path);
    if (image === null) {
      throw new NotFoundError('No such wiki image');
    }

    reply.header('content-type', image.contentType);
    reply.header('cache-control', 'public, max-age=86400');
    reply.header('x-content-type-options', 'nosniff');
    return reply.send(image.body);
  });

  /*
   * BookStack calls this after every change of the book. It cannot sign its
   * requests, so the secret is in the URL. Without a configured secret the
   * hook does not exist.
   */
  app.post('/api/v1/wiki/hook', async (request, reply) => {
    if (config.BOOKSTACK_WEBHOOK_SECRET === '') {
      throw new NotFoundError();
    }

    const { secret } = hookQuery.parse(request.query);
    if (!sameSecret(secret, config.BOOKSTACK_WEBHOOK_SECRET)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    wiki.clear();
    return reply.status(204).send();
  });
}

/** Compares in constant time. Hashing first makes the lengths equal. */
export function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string): Buffer => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
