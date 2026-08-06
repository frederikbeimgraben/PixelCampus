import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { PlanAdapter } from './adapters/plan.js';
import { ServerTapAdapter } from './adapters/servertap.js';
import { SkinAdapter } from './adapters/skins.js';
import type { Config } from './config.js';
import { StatsService } from './domain/stats-service.js';
import { ApiError } from './lib/errors.js';
import { serverRoutes } from './routes/server.js';
import { statsRoutes } from './routes/stats.js';

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
      // Client addresses are personal data; keep them out of the logs.
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

  // Must precede the route registrations: awaiting a register() boots that
  // child context, and a context inherits whichever handler is set at boot.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Invalid request', details: error.issues });
    }

    if (error instanceof ApiError) {
      request.log.warn({ err: error }, error.message);
      return reply.status(error.statusCode).send({ error: error.message });
    }

    // Unexpected: log the detail, tell the client nothing about internals.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: 'Not found' }));

  const serverTap = new ServerTapAdapter(config);
  const plan = new PlanAdapter(config);
  const skins = new SkinAdapter(config);
  const stats = new StatsService(config, plan, serverTap);

  await app.register(serverRoutes, { config, serverTap });
  await app.register(statsRoutes, { config, stats, skins });

  return app;
}
