import { z } from 'zod';

import type { Config } from '../config.js';
import { EMPTY_STATS, type PlayerStats } from '../domain/models.js';
import { NotConfiguredError } from '../lib/errors.js';
import { fetchJson } from '../lib/http.js';

/*
 * PLAN's JSON is shaped for its own dashboard and its keys have moved between
 * v5 releases, so values are looked up through a list of candidate keys rather
 * than a fixed path. Unknown keys yield zero instead of failing the request.
 */

const playerSchema = z.looseObject({
  uuid: z.string().optional(),
  playerUUID: z.string().optional(),
  name: z.string().optional(),
  playerName: z.string().optional(),
});

export interface PlanPlayer {
  readonly uuid: string;
  readonly name: string;
  readonly stats: PlayerStats;
}

/** Reads aggregate statistics from the PLAN (Player Analytics) plugin. */
export class PlanAdapter {
  constructor(private readonly config: Config) {}

  get configured(): boolean {
    return this.config.planConfigured;
  }

  /**
   * @returns Every player PLAN knows about.
   * @throws {NotConfiguredError} If PLAN_URL is unset.
   * @throws {UpstreamError} If PLAN is unreachable or unusable.
   */
  async players(): Promise<readonly PlanPlayer[]> {
    const raw = await this.get('/v1/players');
    const rows = extractRows(raw);
    return rows.map(toPlanPlayer).filter((player): player is PlanPlayer => player !== null);
  }

  /**
   * @param idOrName Player UUID or name.
   * @returns The player, or null when PLAN has no record.
   */
  async player(idOrName: string): Promise<PlanPlayer | null> {
    const raw = await this.get(`/v1/player?player=${encodeURIComponent(idOrName)}`);
    if (raw === null) return null;

    const record = isRecord(raw) && isRecord(raw['player']) ? raw['player'] : raw;
    return isRecord(record) ? toPlanPlayer(record) : null;
  }

  private async get(path: string): Promise<unknown> {
    if (!this.config.PLAN_URL) {
      throw new NotConfiguredError('PLAN');
    }

    const headers: Record<string, string> = {};
    if (this.config.PLAN_USER && this.config.PLAN_PASSWORD) {
      const credentials = Buffer.from(
        `${this.config.PLAN_USER}:${this.config.PLAN_PASSWORD}`,
      ).toString('base64');
      headers['authorization'] = `Basic ${credentials}`;
    }

    return fetchJson(`${trimSlash(this.config.PLAN_URL)}${path}`, {
      timeoutMs: this.config.UPSTREAM_TIMEOUT_MS,
      upstream: 'PLAN',
      headers,
    });
  }
}

/** PLAN wraps its tables in different envelopes per endpoint; find the array. */
function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);

  if (isRecord(raw)) {
    for (const key of ['players', 'data', 'rows', 'result']) {
      const candidate = raw[key];
      if (Array.isArray(candidate)) return candidate.filter(isRecord);
    }
  }

  return [];
}

function toPlanPlayer(row: Record<string, unknown>): PlanPlayer | null {
  const parsed = playerSchema.safeParse(row);
  if (!parsed.success) return null;

  const uuid = parsed.data.uuid ?? parsed.data.playerUUID;
  const name = parsed.data.name ?? parsed.data.playerName;
  if (uuid === undefined && name === undefined) return null;

  return {
    uuid: uuid ?? '',
    name: name ?? uuid ?? 'unknown',
    stats: toStats(row),
  };
}

/** Candidate PLAN keys per statistic, tried in order. */
const STAT_KEYS = {
  playtimeMs: ['playtime_raw', 'playtimeRaw', 'playtime', 'total_playtime_raw'],
  kills: ['player_kills', 'playerKills', 'kills', 'mob_kills'],
  deaths: ['deaths', 'death_count'],
  blocksMined: ['blocks_mined', 'blocksMined', 'mined'],
  blocksPlaced: ['blocks_placed', 'blocksPlaced', 'placed'],
  distanceTravelledBlocks: ['distance_travelled', 'distanceTravelled', 'walk_distance'],
  sessions: ['session_count', 'sessionCount', 'sessions'],
} as const satisfies Record<string, readonly string[]>;

const DATE_KEYS = {
  firstSeen: ['registered', 'register_date', 'firstSeen', 'first_seen'],
  lastSeen: ['last_seen', 'lastSeen', 'last_seen_raw'],
} as const satisfies Record<string, readonly string[]>;

function toStats(row: Record<string, unknown>): PlayerStats {
  return {
    ...EMPTY_STATS,
    playtimeMs: numberAt(row, STAT_KEYS.playtimeMs),
    kills: numberAt(row, STAT_KEYS.kills),
    deaths: numberAt(row, STAT_KEYS.deaths),
    blocksMined: numberAt(row, STAT_KEYS.blocksMined),
    blocksPlaced: numberAt(row, STAT_KEYS.blocksPlaced),
    distanceTravelledBlocks: numberAt(row, STAT_KEYS.distanceTravelledBlocks),
    sessions: numberAt(row, STAT_KEYS.sessions),
    firstSeen: dateAt(row, DATE_KEYS.firstSeen),
    lastSeen: dateAt(row, DATE_KEYS.lastSeen),
  };
}

function numberAt(row: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    // PLAN sometimes pre-formats numbers as strings for its dashboard.
    if (typeof value === 'string') {
      const parsed = Number(value.replaceAll(',', ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function dateAt(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && value > 0) return new Date(value).toISOString();

    if (typeof value === 'string' && value !== '') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trimSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
