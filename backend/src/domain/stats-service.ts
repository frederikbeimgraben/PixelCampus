import type { PlanAdapter, PlanPlayer } from '../adapters/plan.js';
import { playerName, type ServerTapAdapter, type ServerTapPlayer } from '../adapters/servertap.js';
import type { Config } from '../config.js';
import { TtlCache } from '../lib/cache.js';
import { GearCache, type RememberedGear } from './gear-cache.js';
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
  blocksMined: 'blocksMined',
  blocksPlaced: 'blocksPlaced',
  distanceTravelled: 'distanceTravelledBlocks',
};

/** Combines PLAN history with live ServerTap state. */
export class StatsService {
  private readonly cache: TtlCache<readonly PlanPlayer[]>;
  private readonly playerCache: TtlCache<PlanPlayer | null>;
  private readonly onlineCache: TtlCache<readonly ServerTapPlayer[]>;

  constructor(
    config: Config,
    private readonly plan: PlanAdapter,
    private readonly serverTap: ServerTapAdapter,
    private readonly gearCache: GearCache = new GearCache(),
  ) {
    this.cache = new TtlCache(config.CACHE_TTL_SECONDS * 1000);
    this.playerCache = new TtlCache(config.CACHE_TTL_SECONDS * 1000);
    // Online state moves faster than history, so it gets a shorter life.
    this.onlineCache = new TtlCache(Math.min(config.CACHE_TTL_SECONDS, 15) * 1000);
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
   * Records the gear of everyone currently online.
   *
   * Without this, gear is only remembered for players whose profile someone
   * happened to open while they were connected. Polling means anyone who plays
   * has equipment to show once they log off.
   *
   * @returns How many players were recorded.
   */
  async recordOnlineGear(): Promise<number> {
    const online = await this.onlinePlayers();
    let recorded = 0;

    for (const player of online) {
      if (player.uuid === undefined) continue;

      try {
        const gear = await this.serverTap.gear(player.uuid);
        if (gear !== null) {
          this.gearCache.remember(player.uuid, gear);
          recorded++;
        }
      } catch (error) {
        // One unreadable inventory must not stop the rest of the sweep.
        if (!(error instanceof UpstreamError)) throw error;
      }
    }

    return recorded;
  }

  /**
   * @param idOrName Player UUID or name.
   * @returns The merged profile.
   * @throws {NotFoundError} If neither upstream knows the player.
   */
  async player(idOrName: string): Promise<PlayerProfile> {
    const [history, online] = await Promise.all([this.planPlayer(idOrName), this.onlinePlayers()]);

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

    const uuid = history?.uuid ?? live?.uuid ?? '';
    const gear = await this.gearOf(uuid, live);

    return {
      uuid,
      name: history?.name ?? (live === null ? idOrName : playerName(live)),
      online: live !== null,
      stats: history?.stats ?? EMPTY_STATS,
      gear: gear?.gear ?? null,
      gearCapturedAt: gear?.capturedAt ?? null,
      health: live?.health ?? null,
      hunger: live?.hunger ?? null,
    };
  }

  /**
   * The parts of a profile that change while a page is open.
   *
   * Same resolution as {@link player}, minus the statistics, which the live
   * socket has no reason to re-send every few seconds.
   *
   * @param idOrName Player UUID or name.
   * @returns The live view.
   * @throws {NotFoundError} If neither upstream knows the player.
   */
  async livePlayer(idOrName: string): Promise<LivePlayer> {
    const profile = await this.player(idOrName);

    return {
      uuid: profile.uuid,
      name: profile.name,
      online: profile.online,
      gear: profile.gear,
      gearCapturedAt: profile.gearCapturedAt,
      health: profile.health,
      hunger: profile.hunger,
    };
  }

  /**
   * Reads gear from the live server and remembers it, or recalls the last
   * reading when the player is offline.
   *
   * Gear needs a second call even when online, since the player object does not
   * carry it.
   */
  private async gearOf(uuid: string, live: ServerTapPlayer | null): Promise<RememberedGear | null> {
    if (uuid === '') return null;

    if (live === null) {
      return this.gearCache.recall(uuid);
    }

    try {
      const gear = await this.serverTap.gear(uuid);
      if (gear === null) return this.gearCache.recall(uuid);

      this.gearCache.remember(uuid, gear);
      return this.gearCache.recall(uuid);
    } catch (error) {
      // Losing the inventory must not lose the rest of the profile; the last
      // reading is better than nothing.
      if (error instanceof UpstreamError) return this.gearCache.recall(uuid);
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

  /**
   * Cached: the live socket asks for the same profiles every few seconds, and
   * history moves far more slowly than that.
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
