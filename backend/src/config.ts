import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  /** Loopback by default. nginx proxies this service at /api/v1. */
  HOST: z.string().default('127.0.0.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Comma-separated origins allowed to call this API. */
  CORS_ORIGINS: z.string().default('https://pixelcampus.space'),

  /*
   * The game server itself, read with a server list ping. This replaced the
   * ServerTap plugin, whose last release was built against the API of Minecraft
   * 1.20 and held the whole stack at that version. A ping needs no plugin.
   */
  MC_HOST: z.string().default(''),
  MC_PORT: z.coerce.number().int().min(1).max(65535).default(25565),
  /** Name shown for the server. A ping carries no name of its own. */
  SERVER_NAME: z.string().default('PixelCampus'),

  PLAN_URL: z.string().optional(),
  PLAN_USER: z.string().optional(),
  PLAN_PASSWORD: z.string().optional(),

  /**
   * Root of the skin render service. The paths follow mc-heads.net; see
   * renderUrl in the skin adapter.
   */
  SKIN_RENDER_URL: z.string().default('https://mc-heads.net'),

  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
  /** How often the live socket re-reads what its listeners watch. 0 disables it. */
  LIVE_POLL_SECONDS: z.coerce.number().int().min(0).default(5),
  LIVE_MAX_CLIENTS: z.coerce.number().int().min(1).default(200),
  LIVE_PING_SECONDS: z.coerce.number().int().min(5).default(30),

  SKIN_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86400),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
});

export type Config = Readonly<z.infer<typeof schema>> & {
  readonly corsOrigins: readonly string[];
  readonly pingConfigured: boolean;
  readonly planConfigured: boolean;
};

/**
 * Reads and validates configuration from the environment.
 *
 * A missing upstream is not an error. The service starts and reports that
 * feature as unavailable, so one dead plugin does not stop the site.
 *
 * @param env Environment to read. Defaults to the process environment.
 * @returns The validated configuration.
 * @throws {z.ZodError} If a value is present but invalid.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.parse(env);

  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    pingConfigured: parsed.MC_HOST !== '',
    planConfigured: Boolean(parsed.PLAN_URL),
  };
}
