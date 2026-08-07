/**
 * Domain types re-exported from the shared contract.
 *
 * The wire shapes live in @pixelcampus/contract so the front end and this
 * service cannot disagree about them. This module exists so internal code has
 * a stable place to import from.
 */
export type {
  GearItem,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardMetric,
  MetricUnit,
  PlayerGear,
  PlayerProfile,
  PlayerStats,
  ServerInfo,
} from '../contract/index.js';

export { EMPTY_STATS, LEADERBOARD_METRICS, METRIC_UNITS } from '../contract/index.js';
