import { Socket } from 'node:net';

import { z } from 'zod';

import type { Config } from '../config.js';
import type { ServerInfo } from '../domain/models.js';
import { TtlCache } from '../lib/cache.js';
import { NotConfiguredError, UpstreamError } from '../lib/errors.js';
import { PNG_SIGNATURE } from '../lib/http.js';

/**
 * Protocol number sent in the handshake.
 *
 * A server answers a status request from any version, so this number does not
 * tie the site to a version of the game. It only has to be a number the server
 * accepts in the packet.
 */
const PROTOCOL_VERSION = 767;

/** Name of this upstream in errors. */
const UPSTREAM = 'Minecraft server';

/**
 * Longest time one ping answers for, in seconds. CACHE_TTL_SECONDS applies when
 * it is shorter.
 *
 * The status and the icon come from the same answer, so a page view that asks
 * for both costs one ping at most, and a burst of page views costs one. The
 * cap keeps the player counts on a freshly loaded page recent. The live socket
 * does not wait for it: it asks for a fresh answer on every tick.
 */
const STATUS_TTL_SECONDS = 15;

/** The one key in the cache. There is one server to ask. */
const STATUS_KEY = 'status';

/*
 * The answer to a status request. Every field is optional: the shape is set by
 * the server, and a field that is absent must not become a 500 for the page.
 */
const statusSchema = z
  .object({
    version: z.object({ name: z.string().optional() }).loose().optional(),
    players: z
      .object({
        online: z.number().optional(),
        max: z.number().optional(),
        sample: z.array(z.object({ name: z.string().optional() }).loose()).optional(),
      })
      .loose()
      .optional(),
    description: z.json().optional(),
    // Not checked here: a broken icon must not cost the page its status.
    favicon: z.unknown().optional(),
  })
  .loose();

/** One answer to a server list ping. */
export interface PingResult {
  readonly status: unknown;
  /** Round trip in milliseconds, at least 1. */
  readonly latencyMs: number;
}

/**
 * A ping that failed is kept too, for as long as one that succeeded. A stopped
 * server otherwise costs every page view a full timeout.
 */
type PingOutcome = PingResult | UpstreamError;

/**
 * Reads the game server the way a game client does, with a server list ping.
 *
 * This needs no plugin. The answer holds the MOTD, the version, the player
 * counts, a sample of the names and the server icon, which is what the site
 * shows. The sample is not the full list: a server sends about twelve names,
 * and an operator can turn it off.
 */
export class PingAdapter {
  private readonly cache: TtlCache<PingOutcome>;

  constructor(private readonly config: Config) {
    this.cache = new TtlCache(Math.min(config.CACHE_TTL_SECONDS, STATUS_TTL_SECONDS) * 1000);
  }

  get configured(): boolean {
    return this.config.MC_HOST !== '';
  }

  /**
   * @param options Set `fresh` to ping now instead of reusing a recent answer.
   *   The fresh answer then serves the requests that follow it.
   * @returns Name, MOTD, version, player counts and the round trip.
   * @throws {NotConfiguredError} If MC_HOST is unset.
   * @throws {UpstreamError} If the server does not answer.
   */
  async server(options: { readonly fresh?: boolean } = {}): Promise<ServerInfo> {
    const result = await this.status(options.fresh === true);
    return toServerInfo(result.status, this.config.SERVER_NAME, result.latencyMs);
  }

  /**
   * @returns The server icon as PNG bytes, or null when the server sends none.
   * @throws {NotConfiguredError} If MC_HOST is unset.
   * @throws {UpstreamError} If the server does not answer.
   */
  async icon(): Promise<Buffer | null> {
    const result = await this.status(false);
    return faviconPng(result.status);
  }

  private async status(fresh: boolean): Promise<PingResult> {
    if (!this.configured) {
      throw new NotConfiguredError(UPSTREAM);
    }

    if (fresh) this.cache.delete(STATUS_KEY);

    const outcome = await this.cache.get(STATUS_KEY, () =>
      ping(this.config.MC_HOST, this.config.MC_PORT, this.config.UPSTREAM_TIMEOUT_MS).catch(
        (error: unknown) => {
          if (error instanceof UpstreamError) return error;
          throw error;
        },
      ),
    );

    if (outcome instanceof UpstreamError) throw outcome;
    return outcome;
  }
}

/**
 * Turns the answer to a ping into the shape the site uses.
 *
 * Exported for unit tests.
 *
 * @param raw The status object from the server.
 * @param name Name to show for the server. A ping carries no name of its own.
 * @param latencyMs Round trip of the ping that brought the status.
 * @returns The server information.
 */
export function toServerInfo(raw: unknown, name: string, latencyMs: number): ServerInfo {
  const parsed = statusSchema.safeParse(raw);
  const status = parsed.success ? parsed.data : {};

  const sample = status.players?.sample ?? [];

  return {
    name,
    motd: motdText(status.description),
    version: status.version?.name ?? 'unknown',
    online: true,
    playerCount: status.players?.online ?? 0,
    maxPlayerCount: status.players?.max ?? 0,
    players: sample
      .map((player) => player.name)
      .filter((player): player is string => typeof player === 'string'),
    // Passed on as the server sent it. The front end draws the colors from it.
    ...(status.description === undefined ? {} : { description: status.description }),
    latencyMs,
  };
}

/** The only form of icon a server sends: a PNG, as a base64 data URL. */
const FAVICON = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/;

/**
 * Reads the server icon out of the answer to a ping.
 *
 * The bytes are served as image/png, so they must be one. Anything else in the
 * field is taken as no icon.
 *
 * Exported for unit tests.
 *
 * @param raw The status object from the server.
 * @returns The PNG bytes, or null when the server sends no icon or a broken one.
 */
export function faviconPng(raw: unknown): Buffer | null {
  const parsed = statusSchema.safeParse(raw);
  const favicon = parsed.success ? parsed.data.favicon : undefined;
  if (typeof favicon !== 'string') return null;

  const match = FAVICON.exec(favicon);
  if (match === null) return null;

  const bytes = Buffer.from(match[1] ?? '', 'base64');
  return bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ? bytes : null;
}

/** Matches one legacy formatting code, such as the `§b` that colors a word. */
const FORMATTING_CODE = /§[0-9a-fk-or]/gi;

/**
 * Reads the MOTD out of a chat component tree as plain text.
 *
 * The description is a string on some servers and a tree on others. Colors and
 * styles are dropped: this value is read, not drawn.
 *
 * Exported for unit tests.
 */
export function motdText(description: unknown): string {
  return collect(description).replace(FORMATTING_CODE, '').trim();
}

function collect(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collect).join('');

  if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>;
    const own = typeof record['text'] === 'string' ? record['text'] : '';
    const extra = Array.isArray(record['extra']) ? record['extra'].map(collect).join('') : '';
    return own + extra;
  }

  return '';
}

/* --- The protocol -------------------------------------------------------- */

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value | 0;

  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (rest !== 0);

  return Buffer.from(bytes);
}

interface VarInt {
  readonly value: number;
  readonly size: number;
}

/** @returns The number and the bytes it took, or null if the bytes are not all here yet. */
function readVarInt(buffer: Buffer, offset: number): VarInt | null {
  let value = 0;
  let shift = 0;

  for (let index = 0; index < 5; index += 1) {
    if (offset + index >= buffer.length) return null;

    const byte = buffer[offset + index] ?? 0;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, size: index + 1 };
    shift += 7;
  }

  return null;
}

function packet(id: number, ...parts: Buffer[]): Buffer {
  const body = Buffer.concat([varInt(id), ...parts]);
  return Buffer.concat([varInt(body.length), body]);
}

function mcString(text: string): Buffer {
  const bytes = Buffer.from(text, 'utf8');
  return Buffer.concat([varInt(bytes.length), bytes]);
}

/**
 * Sends a handshake and a status request, and reads the answer.
 *
 * @param host Address of the game server.
 * @param port Game port.
 * @param timeoutMs How long to wait for the answer.
 * @returns The status and the round trip.
 * @throws {UpstreamError} If the server does not answer, or answers something
 *   that is not the status.
 */
export function ping(host: string, port: number, timeoutMs: number): Promise<PingResult> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const started = process.hrtime.bigint();

    let received = Buffer.alloc(0);
    let settled = false;

    const fail = (reason: string): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(new UpstreamError(UPSTREAM, reason));
    };

    const succeed = (result: PingResult): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => fail(`${UPSTREAM} did not answer in time`));
    socket.on('error', () => fail(`${UPSTREAM} is unreachable`));
    // Reached only when the server hangs up before the answer is complete.
    socket.on('close', () => fail(`${UPSTREAM} closed the connection`));

    socket.connect(port, host, () => {
      const handshake = packet(
        0x00,
        varInt(PROTOCOL_VERSION),
        mcString(host),
        Buffer.from([port >> 8, port & 0xff]),
        varInt(1), // next state: status
      );

      socket.write(Buffer.concat([handshake, packet(0x00)]));
    });

    socket.on('data', (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);

      // The answer is one frame: its length, the packet id, then a string that
      // carries its own length. Each part may arrive in its own chunk.
      const frame = readVarInt(received, 0);
      if (frame === null || received.length < frame.size + frame.value) return;

      const id = readVarInt(received, frame.size);
      if (id === null) return;

      const length = readVarInt(received, frame.size + id.size);
      if (length === null) return;

      const start = frame.size + id.size + length.size;
      if (received.length < start + length.value) return;

      const latencyMs = Number((process.hrtime.bigint() - started) / 1000000n);

      try {
        const status: unknown = JSON.parse(
          received.subarray(start, start + length.value).toString('utf8'),
        );
        succeed({ status, latencyMs: Math.max(1, latencyMs) });
      } catch {
        fail(`${UPSTREAM} sent a status that is not JSON`);
      }
    });
  });
}
