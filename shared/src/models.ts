import { z } from 'zod';

/**
 * The wire types, defined once for both sides.
 *
 * These schemas are the source of truth. The API checks its responses against
 * them and the front end checks what it receives. Both take their TypeScript
 * types from them.
 *
 * Neither side keeps its own copy. A copy let a renamed field pass the build
 * and blank a panel instead.
 */

/*
 * Blocks mined, blocks placed and distance travelled were here. PLAN is the
 * only source of history, and it records none of the three: neither its table
 * of all players nor the record of one player carries them. A metric with no
 * source is a button that always gives an empty board.
 */
export const LEADERBOARD_METRICS = ['playtime', 'kills', 'deaths'] as const;

export const MetricSchema = z.enum(LEADERBOARD_METRICS);
export type LeaderboardMetric = z.infer<typeof MetricSchema>;

export const MetricUnitSchema = z.enum(['ms', 'count']);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

export const METRIC_UNITS: Readonly<Record<LeaderboardMetric, MetricUnit>> = {
  playtime: 'ms',
  kills: 'count',
  deaths: 'count',
};

export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  uuid: z.string(),
  name: z.string(),
  value: z.number(),
  unit: MetricUnitSchema,
  online: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardSchema = z.object({
  metric: MetricSchema,
  entries: z.array(LeaderboardEntrySchema),
  total: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

/* The three counts PLAN does not record are absent here for the same reason. */
export const PlayerStatsSchema = z.object({
  playtimeMs: z.number().min(0),
  kills: z.number().min(0),
  deaths: z.number().min(0),
  sessions: z.number().min(0),
  firstSeen: z.iso.datetime().nullable(),
  lastSeen: z.iso.datetime().nullable(),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

/*
 * Worn equipment, health and hunger were here. All three came from the
 * ServerTap plugin, which this service no longer uses: its last release is
 * built against the API of Minecraft 1.20 and held the whole stack at that
 * version. PLAN, which serves the history, records none of the three, and a
 * server list ping carries none of them either.
 */
export const PlayerProfileSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  online: z.boolean(),
  stats: PlayerStatsSchema,
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const ServerInfoSchema = z.object({
  name: z.string(),
  motd: z.string(),
  version: z.string(),
  online: z.boolean(),
  playerCount: z.number().int().min(0),
  maxPlayerCount: z.number().int().min(0),
  players: z.array(z.string()),
});
export type ServerInfo = z.infer<typeof ServerInfoSchema>;

export const HealthSchema = z.object({
  status: z.literal('ok'),
  upstreams: z.object({
    /** Whether the game server address is configured, so it can be pinged. */
    ping: z.boolean(),
    plan: z.boolean(),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const EMPTY_STATS: PlayerStats = {
  playtimeMs: 0,
  kills: 0,
  deaths: 0,
  sessions: 0,
  firstSeen: null,
  lastSeen: null,
};
