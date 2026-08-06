/**
 * Response shapes of the PixelCampus backends.
 *
 * The old code passed backend JSON around as `any`, so a field rename upstream
 * showed up as a blank panel at run time. These types make the compiler catch it.
 */

/** One run of colour/style formatting inside a Minecraft chat component. */
export interface FormattedSpan {
  readonly text: string;
  readonly color: string;
  readonly fontFamily: string;
}

/** Raw Minecraft chat component, as sent in a server list ping. */
export interface MinecraftChatComponent {
  readonly text?: string;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly extra?: readonly MinecraftChatComponent[];
}

/** Normalised server list ping result. */
export interface ServerStatus {
  readonly online: boolean;
  readonly latencyMs: number;
  readonly description: readonly FormattedSpan[];
  readonly playerCount: number;
  readonly maxPlayerCount: number;
  readonly players: readonly string[];
  readonly version: string;
}

/** Server status shown before the first response arrives. */
export const OFFLINE_STATUS: ServerStatus = {
  online: false,
  latencyMs: 0,
  description: [],
  playerCount: 0,
  maxPlayerCount: 0,
  players: [],
  version: '',
};

/** One entry of the wiki table of contents. */
export interface WikiPageRef {
  readonly title: string;
  readonly path: string;
  readonly icon?: string;
}

/** Table of contents of the wiki. */
export interface WikiSitemap {
  readonly index: string;
  readonly pages: readonly WikiPageRef[];
}

/** A metric the leaderboard can be sorted by. */
export type LeaderboardMetric =
  | 'playtime'
  | 'kills'
  | 'deaths'
  | 'blocksMined'
  | 'blocksPlaced'
  | 'distanceTravelled';

/** One row of the leaderboard. */
export interface LeaderboardEntry {
  readonly rank: number;
  readonly uuid: string;
  readonly name: string;
  readonly value: number;
  /** Unit of `value`, used to format it for display. */
  readonly unit: 'ms' | 'count' | 'blocks';
  readonly online: boolean;
}

/** A leaderboard page. */
export interface Leaderboard {
  readonly metric: LeaderboardMetric;
  readonly entries: readonly LeaderboardEntry[];
  readonly total: number;
  readonly generatedAt: string;
}

/** One equipped item. */
export interface GearItem {
  /** Namespaced Minecraft id, for example `minecraft:diamond_chestplate`. */
  readonly id: string;
  /** Readable name, for example `Diamond Chestplate`. */
  readonly name: string;
  readonly amount: number;
  /** Enchantment labels, already formatted for display. */
  readonly enchantments: readonly string[];
  /** Remaining durability as a fraction from 0 to 1, or null for items that do not wear. */
  readonly durability: number | null;
}

/** Everything a player currently has equipped. */
export interface PlayerGear {
  readonly helmet: GearItem | null;
  readonly chestplate: GearItem | null;
  readonly leggings: GearItem | null;
  readonly boots: GearItem | null;
  readonly mainHand: GearItem | null;
  readonly offHand: GearItem | null;
}

/** Per-player aggregate statistics. */
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

/** Full player profile shown on the player detail page. */
export interface PlayerProfile {
  readonly uuid: string;
  readonly name: string;
  readonly online: boolean;
  readonly stats: PlayerStats;
  /** Absent when the player is offline, because gear is read from the live server. */
  readonly gear: PlayerGear | null;
  readonly health: number | null;
  readonly hunger: number | null;
  /** Progress towards the next level, 0 to 1. The level itself is not reported. */
  readonly experienceProgress: number | null;
}
