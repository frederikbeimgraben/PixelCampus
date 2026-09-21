import type { Config } from '../config.js';
import { EMPTY_STATS, type PlayerStats } from '../domain/models.js';
import { NotConfiguredError } from '../lib/errors.js';
import { fetchJson } from '../lib/http.js';

/*
 * PLAN serves its own dashboard, so /v1/players returns a DataTables payload.
 * The rows sit under `data`. Most values are objects of the form
 * { v: <sortable raw value>, d: "<display string>" }.
 *
 * Checked against PLAN 5.8 build 3579. This adapter reads the raw `v`. PLAN
 * formats `d` for its own interface.
 */

export interface PlanPlayer {
  readonly uuid: string;
  readonly name: string;
  readonly stats: PlayerStats;
  /**
   * Whether PLAN sees the player on the server now.
   *
   * Only the record of one player carries this. The table of all players does
   * not, so a row from {@link PlanAdapter.players} leaves it false.
   */
  readonly online: boolean;
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
    return extractRows(raw)
      .map(toPlanPlayer)
      .filter((player): player is PlanPlayer => player !== null);
  }

  /**
   * Reads one player.
   *
   * PLAN answers with a whole dashboard, and the values this site wants sit in
   * its `info` block: the name, the UUID, the totals and whether the player is
   * connected. Reading the top level instead gave a player whose statistics
   * were all zero.
   *
   * @param idOrName Player UUID or name.
   * @returns The player, or null when PLAN has no record.
   */
  async player(idOrName: string): Promise<PlanPlayer | null> {
    const raw = await this.get(`/v1/player?player=${encodeURIComponent(idOrName)}`);
    if (!isRecord(raw)) return null;

    const record = isRecord(raw['info'])
      ? raw['info']
      : isRecord(raw['player'])
        ? raw['player']
        : raw;

    return toPlanPlayer(record);
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

/** PLAN uses a different envelope per endpoint. Find the array. */
function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw.filter(isRecord);

  if (isRecord(raw)) {
    for (const key of ['data', 'players', 'rows', 'result']) {
      const candidate = raw[key];
      if (Array.isArray(candidate)) return candidate.filter(isRecord);
    }
  }

  return [];
}

/*
 * The name cell holds markup, not a name. PLAN sends
 *   <a class="link" href="./player/<uuid>">StatBot</a>
 * because the same payload drives its own table. The row has no uuid field, so
 * the link is also the only place the UUID appears.
 */
const PLAYER_LINK = /href="[^"]*\/player\/([0-9a-fA-F-]{32,36})"/;

function toPlanPlayer(row: Record<string, unknown>): PlanPlayer | null {
  const nameCell = stringAt(row, ['name', 'playerName', 'player_name']);
  const uuid = stringAt(row, ['uuid', 'playerUUID', 'player_uuid']) ?? uuidFromLink(nameCell);
  const name = nameCell === null ? null : stripHtml(nameCell);

  if (uuid === null && (name === null || name === '')) return null;

  return {
    uuid: uuid ?? '',
    name: name !== null && name !== '' ? name : (uuid ?? 'unknown'),
    stats: toStats(row),
    online: rawValue(row['online']) === true,
  };
}

function uuidFromLink(cell: string | null): string | null {
  return cell === null ? null : (PLAYER_LINK.exec(cell)?.[1] ?? null);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

/*
 * Candidate PLAN keys per statistic, tried in order. The table of all players
 * and the record of one player name the same value differently, so both
 * spellings are here.
 */
const STAT_KEYS = {
  playtimeMs: ['activePlaytime', 'active_playtime', 'playtime', 'playtime_raw', 'totalPlaytime'],
  kills: ['playerKills', 'player_kills', 'player_kill_count', 'kills'],
  deaths: ['deaths', 'death_count'],
  sessions: ['sessions', 'sessionCount', 'session_count'],
} as const satisfies Record<string, readonly string[]>;

const DATE_KEYS = {
  firstSeen: ['registered', 'register_date', 'firstSeen', 'first_seen'],
  lastSeen: ['seen', 'lastSeen', 'last_seen', 'last_seen_raw_value'],
} as const satisfies Record<string, readonly string[]>;

function toStats(row: Record<string, unknown>): PlayerStats {
  return {
    ...EMPTY_STATS,
    playtimeMs: numberAt(row, STAT_KEYS.playtimeMs),
    kills: numberAt(row, STAT_KEYS.kills),
    deaths: numberAt(row, STAT_KEYS.deaths),
    sessions: numberAt(row, STAT_KEYS.sessions),
    firstSeen: dateAt(row, DATE_KEYS.firstSeen),
    lastSeen: dateAt(row, DATE_KEYS.lastSeen),
  };
}

/**
 * Unwraps a PLAN cell.
 *
 * @returns The sortable raw value from `{ v, d }`, or the value itself when it
 *   is already a scalar.
 */
function rawValue(value: unknown): unknown {
  if (isRecord(value)) {
    if ('v' in value) return value['v'];
    if ('_' in value) return value['_'];
  }
  return value;
}

function numberAt(row: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const value = rawValue(row[key]);
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (typeof value === 'string') {
      const parsed = Number(value.replaceAll(',', ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
}

function stringAt(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = rawValue(row[key]);
    if (typeof value === 'string' && value !== '') return value;
  }

  return null;
}

function dateAt(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = rawValue(row[key]);

    // PLAN sends epoch milliseconds as strings, such as "1786045103425". The
    // Date constructor returns an invalid date for that, so read the number
    // first.
    const epoch = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(epoch) && epoch > 0) return new Date(epoch).toISOString();

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
