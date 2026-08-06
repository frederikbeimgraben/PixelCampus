import type { PlanAdapter, PlanPlayer } from '../adapters/plan.js';
import { playerName, type ServerTapAdapter, type ServerTapPlayer } from '../adapters/servertap.js';
import type { Config } from '../config.js';
import { TtlCache } from '../lib/cache.js';
import { NotFoundError, UpstreamError } from '../lib/errors.js';
import {
  EMPTY_STATS,
  METRIC_UNITS,
  type Leaderboard,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type PlayerGear,
  type PlayerProfile,
  type PlayerStats,
} from './models.js';

/** Maps a metric to the statistic it ranks by. */
const METRIC_FIELD: Readonly<Record<LeaderboardMetric, keyof PlayerStats>> = {
  playtime: 'playtimeMs',
  kills: 'kills',
  deaths: 'deaths',
  blocksMined: 'blocksMined',
  blocksPlaced: 'blocksPlaced',
  distanceTravelled: 'distanceTravelledBlocks',
};

/** Combines PLAN history with live ServerTap state. */
export class StatsService {
  private readonly cache: TtlCache<readonly PlanPlayer[]>;
  private readonly onlineCache: TtlCache<readonly ServerTapPlayer[]>;

  constructor(
    config: Config,
    private readonly plan: PlanAdapter,
    private readonly serverTap: ServerTapAdapter,
  ) {
    this.cache = new TtlCache(config.CACHE_TTL_SECONDS * 1000);
    // Online state moves faster than history, so it gets a shorter life.
    this.onlineCache = new TtlCache(Math.min(config.CACHE_TTL_SECONDS, 15) * 1000);
  }

  /**
   * @param metric Statistic to rank by.
   * @param limit Rows to return.
   * @param offset Rows to skip.
   * @returns The ranked page.
   */
  async leaderboard(metric: LeaderboardMetric, limit: number, offset: number): Promise<Leaderboard> {
    const [players, online] = await Promise.all([this.planPlayers(), this.onlinePlayers()]);
    const onlineNames = new Set(online.map((player) => playerName(player).toLowerCase()));
    const field = METRIC_FIELD[metric];

    const ranked = [...players]
      .sort((a, b) => Number(b.stats[field]) - Number(a.stats[field]))
      .filter((player) => Number(player.stats[field]) > 0);

    const entries: LeaderboardEntry[] = ranked
      .slice(offset, offset + limit)
      .map((player, index) => ({
        rank: offset + index + 1,
        uuid: player.uuid,
        name: player.name,
        value: Number(player.stats[field]),
        unit: METRIC_UNITS[metric],
        online: onlineNames.has(player.name.toLowerCase()),
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
   * @throws {NotFoundError} If neither upstream knows the player.
   */
  async player(idOrName: string): Promise<PlayerProfile> {
    const [history, online] = await Promise.all([
      this.planPlayer(idOrName),
      this.onlinePlayers(),
    ]);

    const live =
      online.find(
        (player) =>
          playerName(player).toLowerCase() === idOrName.toLowerCase() ||
          player.uuid?.toLowerCase() === idOrName.toLowerCase() ||
          (history !== null && player.uuid === history.uuid),
      ) ?? null;

    if (history === null && live === null) {
      throw new NotFoundError(`No player named "${idOrName}"`);
    }

    return {
      uuid: history?.uuid ?? live?.uuid ?? '',
      name: history?.name ?? (live === null ? idOrName : playerName(live)),
      online: live !== null,
      stats: history?.stats ?? EMPTY_STATS,
      gear: await this.gearOf(live),
      health: live?.health ?? null,
      hunger: live?.hunger ?? null,
    };
  }

  /** Gear needs a second call, since the player object does not carry it. */
  private async gearOf(live: ServerTapPlayer | null): Promise<PlayerGear | null> {
    if (live?.uuid === undefined) return null;

    try {
      return await this.serverTap.gear(live.uuid);
    } catch (error) {
      // Losing the inventory must not lose the rest of the profile.
      if (error instanceof UpstreamError) return null;
      throw error;
    }
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

  private async planPlayer(idOrName: string): Promise<PlanPlayer | null> {
    if (!this.plan.configured) return null;

    try {
      return await this.plan.player(idOrName);
    } catch (error) {
      if (error instanceof UpstreamError) return null;
      throw error;
    }
  }

  private async onlinePlayers(): Promise<readonly ServerTapPlayer[]> {
    if (!this.serverTap.configured) return [];

    return this.onlineCache.get('servertap:players', async () => {
      try {
        return await this.serverTap.onlinePlayers();
      } catch (error) {
        if (error instanceof UpstreamError) return [];
        throw error;
      }
    });
  }
}
