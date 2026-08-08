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

export const LEADERBOARD_METRICS = [
  'playtime',
  'kills',
  'deaths',
  'blocksMined',
  'blocksPlaced',
  'distanceTravelled',
] as const;

export const MetricSchema = z.enum(LEADERBOARD_METRICS);
export type LeaderboardMetric = z.infer<typeof MetricSchema>;

export const MetricUnitSchema = z.enum(['ms', 'count', 'blocks']);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

export const METRIC_UNITS: Readonly<Record<LeaderboardMetric, MetricUnit>> = {
  playtime: 'ms',
  kills: 'count',
  deaths: 'count',
  blocksMined: 'count',
  blocksPlaced: 'count',
  distanceTravelled: 'blocks',
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

export const GearItemSchema = z.object({
  /** Namespaced Minecraft id, for example `minecraft:diamond_chestplate`. */
  id: z.string(),
  name: z.string(),
  amount: z.number().int().min(1),
  enchantments: z.array(z.string()),
  /** Remaining durability from 0 to 1, or null for items that do not wear. */
  durability: z.number().min(0).max(1).nullable(),
});
export type GearItem = z.infer<typeof GearItemSchema>;

export const PlayerGearSchema = z.object({
  helmet: GearItemSchema.nullable(),
  chestplate: GearItemSchema.nullable(),
  leggings: GearItemSchema.nullable(),
  boots: GearItemSchema.nullable(),
  mainHand: GearItemSchema.nullable(),
  offHand: GearItemSchema.nullable(),
});
export type PlayerGear = z.infer<typeof PlayerGearSchema>;

export const PlayerStatsSchema = z.object({
  playtimeMs: z.number().min(0),
  kills: z.number().min(0),
  deaths: z.number().min(0),
  blocksMined: z.number().min(0),
  blocksPlaced: z.number().min(0),
  distanceTravelledBlocks: z.number().min(0),
  sessions: z.number().min(0),
  firstSeen: z.iso.datetime().nullable(),
  lastSeen: z.iso.datetime().nullable(),
});
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;

export const PlayerProfileSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  online: z.boolean(),
  stats: PlayerStatsSchema,
  /**
   * Live while the player is online, otherwise the last reading kept for them.
   * Null only when they have never been seen wearing anything.
   */
  gear: PlayerGearSchema.nullable(),
  /** When `gear` was read. Older than now means it is a remembered reading. */
  gearCapturedAt: z.iso.datetime().nullable(),
  health: z.number().nullable(),
  hunger: z.number().nullable(),
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
    serverTap: z.boolean(),
    plan: z.boolean(),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const EMPTY_STATS: PlayerStats = {
  playtimeMs: 0,
  kills: 0,
  deaths: 0,
  blocksMined: 0,
  blocksPlaced: 0,
  distanceTravelledBlocks: 0,
  sessions: 0,
  firstSeen: null,
  lastSeen: null,
};
