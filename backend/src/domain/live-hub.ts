import type { PingAdapter } from '../adapters/ping.js';
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
    latencyMs: 0,
  };
}

/** A value and its serialized form, so "did this change" is one string compare. */
interface Snapshot<T> {
  readonly json: string;
  readonly value: T;
}

function snapshot<T>(value: T): Snapshot<T> {
  return { json: JSON.stringify(value), value };
}

/**
 * A snapshot of the server state that leaves the latency out of the compare.
 *
 * The round trip differs by a millisecond or two on every ping. Compared, it
 * would make every tick a change and send every client a message every few
 * seconds, which is the traffic the hub exists to avoid. The value sent still
 * carries the latency of the reading that changed something else. A client
 * that shows a latency must take it as a sample, not as the current figure.
 */
function serverSnapshot(server: ServerInfo): Snapshot<ServerInfo> {
  const { latencyMs, ...compared } = server;
  return { json: JSON.stringify(compared), value: server };
}

/**
 * Fans live server and player state out to connected clients.
 *
 * One timer serves every client, and it runs only while somebody listens. The
 * game server sees one ping a tick, and PLAN one request per distinct watched
 * player, whatever the number of open browsers.
 *
 * A client gets a value when it starts to watch, and after that only when the
 * value changes. An idle server produces no traffic.
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
    private readonly ping: PingAdapter,
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
   * Points a client at a player and replaces the previous watch. Null leaves
   * the client on server state only.
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

    // Nobody watched this player, so there is nothing to hand over. Read now.
    // Otherwise the page stays blank until the next tick.
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

    // Nothing was read while nobody listened, so the held value is now
    // arbitrarily old. Drop it. The next client then reads a fresh value
    // instead of a stale one that never "changes".
    this.lastServer = null;
    this.lastPlayers.clear();
  }

  /**
   * Reads every watched value once and pushes what changed.
   *
   * Overlapping calls share one pass. A slow upstream must not let ticks pile
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
    const server = serverSnapshot(await this.readServer());

    if (server.json === this.lastServer?.json) return;
    this.lastServer = server;

    for (const subscriber of this.watches.keys()) {
      subscriber.send({ type: 'server', server: server.value });
    }
  }

  private async readServer(): Promise<ServerInfo> {
    if (!this.ping.configured) return offlineServer();

    try {
      // Fresh, not the cached answer the HTTP routes share. The tick is what
      // keeps the counts current, and a cached answer would slow it to the TTL.
      return await this.ping.server({ fresh: true });
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
   * @returns The event to send, or null when the value is unchanged since the
   *   last tick. A failure is always sent and never remembered, so the next
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

  /** The distinct watched players, lower-cased so two spellings are one query. */
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
