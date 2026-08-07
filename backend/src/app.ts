import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { OpenAPIHandler } from '@orpc/openapi/fastify';
import { API_BASE_PATH } from './contract/index.js';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import { PlanAdapter } from './adapters/plan.js';
import { ServerTapAdapter } from './adapters/servertap.js';
import { SkinAdapter } from './adapters/skins.js';
import type { Config } from './config.js';
import { GearCache } from './domain/gear-cache.js';
import { StatsService } from './domain/stats-service.js';
import { ApiError } from './lib/errors.js';
import { buildRouter, type RouterContext } from './routes/router.js';
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

  /*
   * Before the route registrations. Awaiting a register() boots that child
   * context, and a context inherits whichever handler is set at boot, so
   * handlers installed afterwards never apply to those routes.
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

    // Unexpected: log the detail, tell the client nothing about internals.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({ error: 'Internal server error' });
  });

  app.setNotFoundHandler((_request, reply) => reply.status(404).send({ error: 'Not found' }));

  const serverTap = new ServerTapAdapter(config);
  const plan = new PlanAdapter(config);
  const skins = new SkinAdapter(config);
  const gearCache = new GearCache();
  const stats = new StatsService(config, plan, serverTap, gearCache);

  /*
   * The contract is served by oRPC at its declared REST paths, so the wire
   * format stays ordinary JSON over ordinary URLs. Inputs and outputs are
   * validated against the same schemas the front end holds.
   */
  const handler = new OpenAPIHandler<RouterContext>(buildRouter({ config, stats, serverTap }));

  app.all(`${API_BASE_PATH}/*`, async (request, reply) => {
    const { matched } = await handler.handle(request, reply, {
      prefix: API_BASE_PATH,
      context: { log: request.log },
    });

    if (!matched) {
      await reply.status(404).send({ error: 'Not found' });
    }
  });

  // Skin images are binary and cached differently, so they stay a plain route.
  await app.register(skinRoutes, { config, skins });

  /*
   * Liveness at the root as well as in the contract. Orchestrators and uptime
   * checks expect an unversioned /health, and it should not move when the API
   * version does.
   */
  app.get('/health', () => ({
    status: 'ok' as const,
    upstreams: {
      serverTap: config.serverTapConfigured,
      plan: config.planConfigured,
    },
  }));

  startGearPolling(app, config, stats);

  return app;
}

/**
 * Records the gear of everyone online on a timer, so a player who logs off
 * still has equipment to show.
 *
 * Unref'd, so it never holds the process open, and stopped when the server
 * closes.
 */
function startGearPolling(app: FastifyInstance, config: Config, stats: StatsService): void {
  if (config.GEAR_POLL_SECONDS === 0 || !config.serverTapConfigured) {
    return;
  }

  const timer = setInterval(() => {
    void stats
      .recordOnlineGear()
      .then((count) => {
        if (count > 0) app.log.debug({ count }, 'recorded gear');
      })
      .catch((error: unknown) => app.log.warn({ err: error }, 'gear sweep failed'));
  }, config.GEAR_POLL_SECONDS * 1000);

  timer.unref();
  app.addHook('onClose', () => clearInterval(timer));
}
