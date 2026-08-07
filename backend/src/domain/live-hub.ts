import type { ServerTapAdapter } from '../adapters/servertap.js';
import type { Config } from '../config.js';
import { UpstreamError } from '../lib/errors.js';
import type { StatsService } from './stats-service.js';
import type { LiveEvent, LivePlayer, ServerInfo } from './models.js';

/** One connected client. */
export interface LiveSubscriber {
  send(event: LiveEvent): void;
}

/** What a listener sees when the game server is unreachable. */
export function offlineServer(): ServerInfo {
  return {
    name: 'PixelCampus',
    motd: '',
    version: 'unknown',
    online: false,
    playerCount: 0,
    maxPlayerCount: 0,
    players: [],
  };
}

/** A value and its serialisation, so "did this change" is one string compare. */
interface Snapshot<T> {
  readonly json: string;
  readonly value: T;
}

function snapshot<T>(value: T): Snapshot<T> {
  return { json: JSON.stringify(value), value };
}

/**
 * Fans live server and player state out to connected clients.
 *
 * One timer serves every client, and it only runs while somebody is listening:
 * the number of queries the game server sees depends on how many distinct
 * players are being watched, not on how many browsers are open. Clients are
 * sent a value when they start watching and after that only when it changes,
 * so an idle server produces no traffic.
 */
export class LiveHub {
  /** Subscriber to the player it watches, or null for server state only. */
  private readonly watches = new Map<LiveSubscriber, string | null>();

  private lastServer: Snapshot<ServerInfo> | null = null;
  private readonly lastPlayers = new Map<string, Snapshot<LivePlayer>>();

  private timer: NodeJS.Timeout | null = null;
  private ticking: Promise<void> | null = null;

  constructor(
    private readonly config: Config,
    private readonly stats: StatsService,
    private readonly serverTap: ServerTapAdapter,
    private readonly log: { warn: (details: unknown, message: string) => void },
  ) {}

  /** How many clients are connected. */
  get size(): number {
    return this.watches.size;
  }

  /** Registers a client and sends it the current server state. */
  add(subscriber: LiveSubscriber): void {
    this.watches.set(subscriber, null);
    this.start();

    if (this.lastServer !== null) {
      subscriber.send({ type: 'server', server: this.lastServer.value });
    }
  }

  remove(subscriber: LiveSubscriber): void {
    this.watches.delete(subscriber);
    this.forgetUnwatched();

    if (this.watches.size === 0) {
      this.stop();
    }
  }

  /**
   * Points a client at a player, replacing whatever it watched before. Null
   * leaves it on server state only.
   */
  watch(subscriber: LiveSubscriber, player: string | null): void {
    if (!this.watches.has(subscriber)) return;

    this.watches.set(subscriber, player);
    this.forgetUnwatched();

    if (player === null) return;

    const known = this.lastPlayers.get(player.toLowerCase());
    if (known !== undefined) {
      subscriber.send({ type: 'player', player: known.value });
      return;
    }

    // Nobody was watching this one, so there is nothing to hand over: read now
    // rather than leaving the page blank until the next tick.
    void this.tick();
  }

  /** Stops the timer. Called when the server closes. */
  close(): void {
    this.stop();
    this.watches.clear();
  }

  private start(): void {
    if (this.timer !== null || this.config.LIVE_POLL_SECONDS === 0) return;

    this.timer = setInterval(() => void this.tick(), this.config.LIVE_POLL_SECONDS * 1000);
    this.timer.unref();
    void this.tick();
  }

  private stop(): void {
    if (this.timer === null) return;

    clearInterval(this.timer);
    this.timer = null;

    // Nothing was read while nobody listened, so what is held is arbitrarily
    // old. Dropping it makes the next client fetch a fresh value instead of
    // being handed a stale one that then never "changes".
    this.lastServer = null;
    this.lastPlayers.clear();
  }

  /**
   * Reads every watched value once and pushes what changed.
   *
   * Overlapping calls share one pass: a slow upstream must not let ticks pile
   * up into a query storm against the game server.
   */
  tick(): Promise<void> {
    this.ticking ??= this.run().finally(() => {
      this.ticking = null;
    });

    return this.ticking;
  }

  private async run(): Promise<void> {
    await this.pushServer();
    await this.pushPlayers();
  }

  private async pushServer(): Promise<void> {
    const server = snapshot(await this.readServer());

    if (server.json === this.lastServer?.json) return;
    this.lastServer = server;

    for (const subscriber of this.watches.keys()) {
      subscriber.send({ type: 'server', server: server.value });
    }
  }

  private async readServer(): Promise<ServerInfo> {
    if (!this.serverTap.configured) return offlineServer();

    try {
      return await this.serverTap.server();
    } catch (error) {
      if (error instanceof UpstreamError) return offlineServer();
      throw error;
    }
  }

  private async pushPlayers(): Promise<void> {
    for (const key of this.watchedPlayers()) {
      const event = await this.readPlayer(key);
      if (event === null) continue;

      for (const [subscriber, watched] of this.watches) {
        if (watched?.toLowerCase() === key) subscriber.send(event);
      }
    }
  }

  /**
   * @returns The event to send, or null when the value has not changed since
   *   the last tick. A failure is always sent, never remembered, so the next
   *   tick retries instead of treating it as the current state.
   */
  private async readPlayer(key: string): Promise<LiveEvent | null> {
    let player: LivePlayer;

    try {
      player = await this.stats.livePlayer(key);
    } catch (error) {
      this.log.warn({ err: error, player: key }, 'live player read failed');
      return { type: 'error', message: `Cannot read "${key}" right now` };
    }

    const current = snapshot(player);
    if (current.json === this.lastPlayers.get(key)?.json) return null;

    this.lastPlayers.set(key, current);
    return { type: 'player', player };
  }

  /** The distinct players watched, lower-cased so two spellings are one query. */
  private watchedPlayers(): Set<string> {
    const keys = new Set<string>();

    for (const watched of this.watches.values()) {
      if (watched !== null) keys.add(watched.toLowerCase());
    }

    return keys;
  }

  private forgetUnwatched(): void {
    const watched = this.watchedPlayers();

    for (const key of this.lastPlayers.keys()) {
      if (!watched.has(key)) this.lastPlayers.delete(key);
    }
  }
}
