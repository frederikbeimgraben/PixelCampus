import type { PlanAdapter, PlanPlayer } from '../adapters/plan.js';
import type { PingAdapter } from '../adapters/ping.js';
import type { Config } from '../config.js';
import { TtlCache } from '../lib/cache.js';
import { NotFoundError, UpstreamError } from '../lib/errors.js';
import {
  EMPTY_STATS,
  METRIC_UNITS,
  type Leaderboard,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type LivePlayer,
  type PlayerProfile,
  type PlayerStats,
} from './models.js';

/** Maps a metric to the statistic it ranks by. */
const METRIC_FIELD: Readonly<Record<LeaderboardMetric, keyof PlayerStats>> = {
  playtime: 'playtimeMs',
  kills: 'kills',
  deaths: 'deaths',
};

/**
 * Metrics that the table of all players does not carry.
 *
 * PLAN serves that table for its own dashboard, and it holds the name, the
 * playtime, the session count and the dates. A kill count and a death count
 * are in the record of one player only, so ranking by either one needs a
 * request for every player.
 */
const NEEDS_DETAIL: ReadonlySet<LeaderboardMetric> = new Set<LeaderboardMetric>([
  'kills',
  'deaths',
]);

/** How many player records to ask PLAN for at a time. */
const DETAIL_CONCURRENCY = 4;

/**
 * Combines the history PLAN holds with who is on the server now.
 *
 * Two upstreams answer "who is online", and neither answers it alone. A ping
 * gives the names the server puts in its sample, which is about twelve of them
 * and can be turned off. PLAN gives a reliable answer for one named player,
 * but its table of all players does not carry the flag. A name from the sample
 * is therefore taken as online, and any other name is asked about separately.
 */
export class StatsService {
  private readonly cache: TtlCache<readonly PlanPlayer[]>;
  private readonly detailCache: TtlCache<readonly PlanPlayer[]>;
  private readonly playerCache: TtlCache<PlanPlayer | null>;
  private readonly rosterCache: TtlCache<ReadonlySet<string>>;

  constructor(
    config: Config,
    private readonly plan: PlanAdapter,
    private readonly ping: PingAdapter,
  ) {
    this.cache = new TtlCache(config.CACHE_TTL_SECONDS * 1000);
    // One request per player, so it is held at least as long as the table.
    this.detailCache = new TtlCache(config.CACHE_TTL_SECONDS * 1000);
    // Who is online moves faster than history, so both get a shorter life.
    this.playerCache = new TtlCache(Math.min(config.CACHE_TTL_SECONDS, 15) * 1000);
    this.rosterCache = new TtlCache(Math.min(config.CACHE_TTL_SECONDS, 15) * 1000);
  }

  /**
   * @param metric Statistic to rank by.
   * @param limit Rows to return.
   * @param offset Rows to skip.
   * @returns The ranked page.
   */
  async leaderboard(
    metric: LeaderboardMetric,
    limit: number,
    offset: number,
  ): Promise<Leaderboard> {
    const [players, roster] = await Promise.all([
      NEEDS_DETAIL.has(metric) ? this.detailedPlayers() : this.planPlayers(),
      this.roster(),
    ]);
    const field = METRIC_FIELD[metric];

    // Everybody PLAN knows is listed, including a player whose count is zero.
    // Dropping those hid every player from a board until they scored once, and
    // a board with nothing on it reads as broken rather than as empty.
    const ranked = [...players].sort((a, b) => Number(b.stats[field]) - Number(a.stats[field]));

    const entries: LeaderboardEntry[] = ranked
      .slice(offset, offset + limit)
      .map((player, index) => ({
        rank: offset + index + 1,
        uuid: player.uuid,
        name: player.name,
        value: Number(player.stats[field]),
        unit: METRIC_UNITS[metric],
        // Only the sample, never a request per row. A page of twenty-five rows
        // would otherwise be twenty-five requests to PLAN.
        online: roster.has(player.name.toLowerCase()),
      }));

    return {
      metric,
      entries,
      total: ranked.length,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * @param idOrName Player UUID or name.
   * @returns The merged profile.
   * @throws {NotFoundError} If PLAN has no record and the player is not online.
   */
  async player(idOrName: string): Promise<PlayerProfile> {
    const [history, roster] = await Promise.all([this.planPlayer(idOrName), this.roster()]);

    const inSample =
      roster.has(idOrName.toLowerCase()) ||
      (history !== null && roster.has(history.name.toLowerCase()));

    if (history === null && !inSample) {
      throw new NotFoundError(`No player named "${idOrName}"`);
    }

    return {
      uuid: history?.uuid ?? '',
      name: history?.name ?? idOrName,
      // PLAN knows for certain. The sample is the fallback, for a player who
      // has joined but whom PLAN has not recorded yet.
      online: history?.online === true || inSample,
      stats: history?.stats ?? EMPTY_STATS,
    };
  }

  /**
   * The parts of a profile that change while a page is open.
   *
   * Resolved as {@link player}, without the statistics. The live socket has no
   * reason to send those again every few seconds.
   *
   * @param idOrName Player UUID or name.
   * @returns The live view.
   * @throws {NotFoundError} If the player is not known.
   */
  async livePlayer(idOrName: string): Promise<LivePlayer> {
    const { stats, ...live } = await this.player(idOrName);
    return live;
  }

  private async planPlayers(): Promise<readonly PlanPlayer[]> {
    if (!this.plan.configured) return [];

    return this.cache.get('plan:players', async () => {
      try {
        return await this.plan.players();
      } catch (error) {
        // A dead PLAN yields an empty board rather than a failed page.
        if (error instanceof UpstreamError) return [];
        throw error;
      }
    });
  }

  /**
   * Every player, with the counts that only a player's own record carries.
   *
   * This is one request to PLAN per player. It is cached as a whole, and asked
   * for only by a metric that needs it, so the usual board still costs one
   * request. A record that cannot be read keeps the row from the table, which
   * ranks that player as zero rather than dropping them.
   */
  private async detailedPlayers(): Promise<readonly PlanPlayer[]> {
    const listed = await this.planPlayers();
    if (listed.length === 0) return listed;

    return this.detailCache.get('plan:detailed', () =>
      mapWithLimit(listed, DETAIL_CONCURRENCY, async (player) => {
        try {
          const detailed = await this.plan.player(player.uuid === '' ? player.name : player.uuid);
          if (detailed === null) return player;

          // The table knows the name and the UUID. The record knows the counts.
          return { ...detailed, uuid: player.uuid, name: player.name };
        } catch (error) {
          if (error instanceof UpstreamError) return player;
          throw error;
        }
      }),
    );
  }

  /**
   * Cached. The live socket asks for the same profiles every few seconds, and
   * a profile is one request to PLAN.
   */
  private async planPlayer(idOrName: string): Promise<PlanPlayer | null> {
    if (!this.plan.configured) return null;

    return this.playerCache.get(`plan:player:${idOrName.toLowerCase()}`, async () => {
      try {
        return await this.plan.player(idOrName);
      } catch (error) {
        if (error instanceof UpstreamError) return null;
        throw error;
      }
    });
  }

  /**
   * @returns The lower-cased names in the player sample of the last ping, which
   *   is empty when the server is unreachable.
   */
  private async roster(): Promise<ReadonlySet<string>> {
    if (!this.ping.configured) return new Set();

    return this.rosterCache.get('ping:roster', async () => {
      try {
        const server = await this.ping.server();
        return new Set(server.players.map((name) => name.toLowerCase()));
      } catch (error) {
        if (error instanceof UpstreamError) return new Set<string>();
        throw error;
      }
    });
  }
}

/**
 * Runs an operation over every item, a few at a time.
 *
 * A server with many players would otherwise open one connection per player at
 * the same moment.
 *
 * @param items The items to work through.
 * @param limit How many operations may run at once.
 * @param operation What to do with one item.
 * @returns The results, in the order of the items.
 */
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;
      results[index] = await operation(items[index] as T);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
