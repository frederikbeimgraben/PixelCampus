/** Response shapes served to the front end. Mirrored in the Angular app's core/api/models.ts. */

export type LeaderboardMetric =
  | 'playtime'
  | 'kills'
  | 'deaths'
  | 'blocksMined'
  | 'blocksPlaced'
  | 'distanceTravelled';

export const LEADERBOARD_METRICS: readonly LeaderboardMetric[] = [
  'playtime',
  'kills',
  'deaths',
  'blocksMined',
  'blocksPlaced',
  'distanceTravelled',
];

export type MetricUnit = 'ms' | 'count' | 'blocks';

export const METRIC_UNITS: Readonly<Record<LeaderboardMetric, MetricUnit>> = {
  playtime: 'ms',
  kills: 'count',
  deaths: 'count',
  blocksMined: 'count',
  blocksPlaced: 'count',
  distanceTravelled: 'blocks',
};

export interface LeaderboardEntry {
  readonly rank: number;
  readonly uuid: string;
  readonly name: string;
  readonly value: number;
  readonly unit: MetricUnit;
  readonly online: boolean;
}

export interface Leaderboard {
  readonly metric: LeaderboardMetric;
  readonly entries: readonly LeaderboardEntry[];
  readonly total: number;
  readonly generatedAt: string;
}

export interface GearItem {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly enchantments: readonly string[];
  /** Remaining durability from 0 to 1, or null for items that do not wear. */
  readonly durability: number | null;
}

export interface PlayerGear {
  readonly helmet: GearItem | null;
  readonly chestplate: GearItem | null;
  readonly leggings: GearItem | null;
  readonly boots: GearItem | null;
  readonly mainHand: GearItem | null;
  readonly offHand: GearItem | null;
}

export interface PlayerStats {
  readonly playtimeMs: number;
  readonly kills: number;
  readonly deaths: number;
  readonly blocksMined: number;
  readonly blocksPlaced: number;
  readonly distanceTravelledBlocks: number;
  readonly sessions: number;
  readonly firstSeen: string | null;
  readonly lastSeen: string | null;
}

export interface PlayerProfile {
  readonly uuid: string;
  readonly name: string;
  readonly online: boolean;
  readonly stats: PlayerStats;
  /** Null when offline: gear is read from the live server. */
  readonly gear: PlayerGear | null;
  readonly health: number | null;
  readonly hunger: number | null;
  readonly level: number | null;
}

export interface ServerInfo {
  readonly name: string;
  readonly motd: string;
  readonly version: string;
  readonly online: boolean;
  readonly playerCount: number;
  readonly maxPlayerCount: number;
  readonly players: readonly string[];
}

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
