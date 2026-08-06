import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  /** Comma-separated origins allowed to call this API. */
  CORS_ORIGINS: z.string().default('https://pixelcampus.space'),

  SERVERTAP_URL: z.string().optional(),
  SERVERTAP_KEY: z.string().optional(),

  PLAN_URL: z.string().optional(),
  PLAN_USER: z.string().optional(),
  PLAN_PASSWORD: z.string().optional(),

  SKIN_RENDER_URL: z.string().default('https://crafatar.com'),

  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
  SKIN_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86400),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
});

export type Config = Readonly<z.infer<typeof schema>> & {
  readonly corsOrigins: readonly string[];
  readonly serverTapConfigured: boolean;
  readonly planConfigured: boolean;
};

/**
 * Reads and validates configuration from the environment.
 *
 * A missing upstream is not an error: the service starts and reports that
 * feature as unavailable, so one dead plugin does not take the site down.
 *
 * @param env Environment to read; defaults to the process environment.
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
    serverTapConfigured: Boolean(parsed.SERVERTAP_URL),
    planConfigured: Boolean(parsed.PLAN_URL),
  };
}
