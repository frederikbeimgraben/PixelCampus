import { LeaderboardMetric } from '../../core/api/models';

/** Human-readable name of each leaderboard metric. */
export const METRIC_LABELS: Readonly<Record<LeaderboardMetric, string>> = {
  playtime: 'Playtime',
  kills: 'Kills',
  deaths: 'Deaths',
  blocksMined: 'Blocks Mined',
  blocksPlaced: 'Blocks Placed',
  distanceTravelled: 'Distance',
};

/** The metrics offered in the leaderboard selector, in display order. */
export const METRICS: readonly LeaderboardMetric[] = [
  'playtime',
  'kills',
  'deaths',
  'blocksMined',
  'blocksPlaced',
  'distanceTravelled',
];

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Formats a duration as `3d 4h`, `4h 20m` or `12m`.
 *
 * @param milliseconds Duration to format. Negative values are treated as zero.
 */
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0m';
  }

  const days = Math.floor(milliseconds / MS_PER_DAY);
  const hours = Math.floor((milliseconds % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((milliseconds % MS_PER_HOUR) / MS_PER_MINUTE);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Formats a count with thousands separators. */
export function formatCount(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString('en-GB') : '0';
}

/** Formats a distance in blocks, switching to kilometres past 1000 blocks. */
export function formatBlocks(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value < 1000) return `${Math.round(value)} blocks`;
  return `${(value / 1000).toFixed(1)} km`;
}

/** Formats a leaderboard value according to its unit. */
export function formatValue(value: number, unit: 'ms' | 'count' | 'blocks'): string {
  switch (unit) {
    case 'ms':
      return formatDuration(value);
    case 'blocks':
      return formatBlocks(value);
    case 'count':
      return formatCount(value);
  }
}

/** Formats an ISO timestamp as a short local date, or a dash when absent. */
export function formatDate(iso: string | null): string {
  if (iso === null) return '-';

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
}
