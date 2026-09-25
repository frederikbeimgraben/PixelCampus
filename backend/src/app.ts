import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { OpenAPIHandler } from '@orpc/openapi/fastify';
import { API_BASE_PATH } from './contract/index.js';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { PlanAdapter } from './adapters/plan.js';
import { PingAdapter } from './adapters/ping.js';
import { SkinAdapter } from './adapters/skins.js';
import type { Config } from './config.js';
import { LiveHub } from './domain/live-hub.js';
import { StatsService } from './domain/stats-service.js';
import { ApiError } from './lib/errors.js';
import { liveRoutes } from './routes/live.js';
import { buildRouter, type RouterContext } from './routes/router.js';
import { serverIconRoutes } from './routes/server-icon.js';
import { skinRoutes } from './routes/skin.js';

/**
 * Builds the HTTP application.
 *
 * Separate from the listener so tests can drive it through `app.inject()`
 * without binding a port.
 *
 * @param config Validated configuration.
 * @returns The configured Fastify instance.
 */
export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Client addresses are personal data. Keep them out of the logs.
      redact: ['req.headers.authorization', 'req.headers.key', 'req.remoteAddress'],
    },
    trustProxy: true,
  });

  await app.register(cors, {
    origin: [...config.corsOrigins],
    methods: ['GET'],
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
  });

  /*
   * This runs before the route registrations. An awaited register() boots that
   * child context, and a context inherits the handler set at boot. A handler
   * installed later never applies to those routes.
   */
  app.setErrorHandler((error, request, reply) => {
    // Routes outside the contract, such as the skin proxy, still validate with
    // zod directly and must answer 400 rather than 500.
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Invalid request', details: error.issues });
    }

    if (error instanceof ApiError) {
      request.log.warn({ err: error }, error.message);
      return reply.status(error.statusCode).send({ error: error.message });
    }

    // Unexpected. Log the detail and tell the client nothing about internals.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: 'Not found' }));

  const ping = new PingAdapter(config);
  const plan = new PlanAdapter(config);
  const skins = new SkinAdapter(config);
  const stats = new StatsService(config, plan, ping);

  /*
   * oRPC serves the contract at its declared REST paths, so the wire format
   * stays plain JSON over plain URLs. It checks inputs and outputs against the
   * same schemas the front end holds.
   */
  const handler = new OpenAPIHandler<RouterContext>(buildRouter({ config, stats, ping }));

  app.all(`${API_BASE_PATH}/*`, async (request, reply) => {
    const { matched } = await handler.handle(request, reply, {
      prefix: API_BASE_PATH,
      context: { log: request.log },
    });

    if (!matched) {
      await reply.status(404).send({ error: 'Not found' });
    }
  });

  // Skin images and the server icon are binary and cached differently, so
  // they stay plain routes.
  await app.register(skinRoutes, { config, skins });
  await app.register(serverIconRoutes, { ping });

  const hub = new LiveHub(config, stats, ping, app.log);
  await app.register(liveRoutes, { config, hub });
  app.addHook('onClose', () => hub.close());

  /*
   * Liveness at the root as well as in the contract. Orchestrators and uptime
   * checks expect an unversioned /health. It must not move when the API
   * version moves.
   */
  app.get('/health', () => ({
    status: 'ok' as const,
    upstreams: {
      ping: config.pingConfigured,
      plan: config.planConfigured,
    },
  }));

  return app;
}
