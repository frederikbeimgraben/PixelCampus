import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  API_BASE_PATH,
  LIVE_PATH,
  LiveEventSchema,
  type LiveCommand,
  type LivePlayer,
  type ServerInfo,
} from '@pixelcampus/contract';

import { API_CONFIG } from './api-config';

/** Reconnect delays, in milliseconds. The last one repeats. */
const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000] as const;

/**
 * Live server and player state, pushed over a WebSocket.
 *
 * One socket per tab serves the whole app. Only one player detail page is open
 * at a time, so one `player` signal is enough. Another player replaces the
 * watch, and leaving the page clears it.
 *
 * Values are null until the first message arrives. A caller must read that as
 * "no live data" and keep the values it fetched. The socket improves on the
 * REST responses. It does not replace them, and it may never connect.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  /** Whether the socket is currently connected. */
  readonly connected = signal(false);

  readonly server = signal<ServerInfo | null>(null);
  readonly player = signal<LivePlayer | null>(null);

  private readonly config = inject(API_CONFIG);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private socket: WebSocket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private watched: string | null = null;
  private closing = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());

    if (this.browser) {
      this.connect();
    }
  }

  /**
   * Watches one player, or nothing.
   *
   * @param player UUID or name, or null to stop watching.
   */
  watch(player: string | null): void {
    if (player === this.watched) return;

    this.watched = player;
    this.player.set(null);
    this.send({ type: 'watch', player });
  }

  private connect(): void {
    this.closing = false;

    const socket = new WebSocket(this.url());
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.attempt = 0;
      this.connected.set(true);

      // The socket can drop while a player page is open. The server knows
      // nothing about the watch on the old connection.
      if (this.watched !== null) {
        this.send({ type: 'watch', player: this.watched });
      }
    });

    socket.addEventListener('message', (event: MessageEvent<string>) => this.receive(event.data));

    socket.addEventListener('close', () => {
      this.connected.set(false);
      this.socket = null;
      this.reconnect();
    });

    // 'error' is always followed by 'close', which does the reconnecting.
    socket.addEventListener('error', () => this.connected.set(false));
  }

  private receive(raw: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const event = LiveEventSchema.safeParse(parsed);
    if (!event.success) return;

    switch (event.data.type) {
      case 'server':
        this.server.set(event.data.server);
        break;
      case 'player':
        this.player.set(event.data.player);
        break;
      case 'error':
        // The page already holds what it fetched over REST. A failed live read
        // stops the updates. It is not an error to show.
        this.player.set(null);
        break;
    }
  }

  private send(command: LiveCommand): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command));
    }
  }

  private reconnect(): void {
    if (this.closing || this.retry !== null) return;

    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;

    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, delay);
  }

  private disconnect(): void {
    this.closing = true;

    if (this.retry !== null) {
      clearTimeout(this.retry);
      this.retry = null;
    }

    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }

  /** The socket URL, on the same origin and scheme as the API. */
  private url(): string {
    const base = new URL(`${this.config.statsBaseUrl}${API_BASE_PATH}${LIVE_PATH}`);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    return base.href;
  }
}
