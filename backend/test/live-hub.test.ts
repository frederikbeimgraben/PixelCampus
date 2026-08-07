import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../src/config.js';
import { LiveHub, type LiveSubscriber } from '../src/domain/live-hub.js';
import type { StatsService } from '../src/domain/stats-service.js';
import type { ServerTapAdapter } from '../src/adapters/servertap.js';
import type { LiveEvent, LivePlayer, ServerInfo } from '../src/domain/models.js';
import { NotFoundError } from '../src/lib/errors.js';

const config = loadConfig({ LOG_LEVEL: 'fatal', LIVE_POLL_SECONDS: '5' } as NodeJS.ProcessEnv);

const log = { warn: () => undefined };

function serverInfo(playerCount: number): ServerInfo {
  return {
    name: 'PixelCampus',
    motd: 'hi',
    version: '1.20.4',
    online: true,
    playerCount,
    maxPlayerCount: 60,
    players: [],
  };
}

function livePlayer(health: number): LivePlayer {
  return {
    uuid: 'u-1',
    name: 'Notch',
    online: true,
    gear: null,
    gearCapturedAt: null,
    health,
    hunger: 20,
  };
}

/** Records what one client was sent. */
function recorder(): LiveSubscriber & { events: LiveEvent[] } {
  const events: LiveEvent[] = [];
  return { events, send: (event) => events.push(event) };
}

interface Harness {
  hub: LiveHub;
  server: ReturnType<typeof vi.fn>;
  player: ReturnType<typeof vi.fn>;
}

function harness(configured = true): Harness {
  const server = vi.fn(() => Promise.resolve(serverInfo(1)));
  const player = vi.fn(() => Promise.resolve(livePlayer(20)));

  const serverTap = { configured, server } as unknown as ServerTapAdapter;
  const stats = { livePlayer: player } as unknown as StatsService;

  return { hub: new LiveHub(config, stats, serverTap, log), server, player };
}

/** Lets the hub's in-flight reads settle; a tick is a couple of microtasks deep. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('LiveHub', () => {
  let h: Harness;

  beforeEach(() => {
    h = harness();
  });

  it('sends the server state to a client that joins', async () => {
    const client = recorder();
    h.hub.add(client);
    await settle();

    expect(client.events).toEqual([{ type: 'server', server: serverInfo(1) }]);
    h.hub.close();
  });

  it('hands a second client the state already read, without querying again', async () => {
    const first = recorder();
    h.hub.add(first);
    await settle();

    const second = recorder();
    h.hub.add(second);

    expect(second.events).toEqual([{ type: 'server', server: serverInfo(1) }]);
    expect(h.server).toHaveBeenCalledTimes(1);
    h.hub.close();
  });

  it('sends nothing when a reading has not changed', async () => {
    const client = recorder();
    h.hub.add(client);
    await settle();
    client.events.length = 0;

    await h.hub.tick();

    expect(client.events).toEqual([]);
    h.hub.close();
  });

  it('sends the new value when a reading changes', async () => {
    const client = recorder();
    h.hub.add(client);
    await settle();
    client.events.length = 0;

    h.server.mockResolvedValueOnce(serverInfo(7));
    await h.hub.tick();

    expect(client.events).toEqual([{ type: 'server', server: serverInfo(7) }]);
    h.hub.close();
  });

  it('reads a watched player once for every client watching them', async () => {
    const first = recorder();
    const second = recorder();
    h.hub.add(first);
    h.hub.add(second);
    await settle();

    h.hub.watch(first, 'Notch');
    h.hub.watch(second, 'notch');
    await settle();

    expect(h.player).toHaveBeenCalledTimes(1);
    expect(first.events).toContainEqual({ type: 'player', player: livePlayer(20) });
    expect(second.events).toContainEqual({ type: 'player', player: livePlayer(20) });
    h.hub.close();
  });

  it('stops reading a player once nobody watches them', async () => {
    const client = recorder();
    h.hub.add(client);
    h.hub.watch(client, 'Notch');
    await settle();

    h.player.mockClear();
    h.hub.watch(client, null);
    await h.hub.tick();

    expect(h.player).not.toHaveBeenCalled();
    h.hub.close();
  });

  it('reports a player it cannot read without dropping the client', async () => {
    const client = recorder();
    h.hub.add(client);
    h.player.mockRejectedValueOnce(new NotFoundError('No player named "ghost"'));

    h.hub.watch(client, 'ghost');
    await settle();

    expect(client.events).toContainEqual({
      type: 'error',
      message: 'Cannot read "ghost" right now',
    });
    h.hub.close();
  });

  it('retries after a failure rather than treating it as the current state', async () => {
    const client = recorder();
    h.hub.add(client);
    h.player.mockRejectedValueOnce(new NotFoundError('gone'));

    h.hub.watch(client, 'Notch');
    await settle();
    await h.hub.tick();

    expect(client.events).toContainEqual({ type: 'player', player: livePlayer(20) });
    h.hub.close();
  });

  it('re-reads for a client that arrives after the last one left', async () => {
    const first = recorder();
    h.hub.add(first);
    await settle();
    h.hub.remove(first);

    expect(h.hub.size).toBe(0);

    // Whatever was read before is now arbitrarily old, so it must not be
    // handed on as though it were current.
    const second = recorder();
    h.hub.add(second);
    await settle();

    expect(h.server).toHaveBeenCalledTimes(2);
    expect(second.events).toEqual([{ type: 'server', server: serverInfo(1) }]);
    h.hub.close();
  });

  it('reports the server offline when ServerTap is not configured', async () => {
    const bare = harness(false);
    const client = recorder();
    bare.hub.add(client);
    await settle();

    expect(client.events).toEqual([
      { type: 'server', server: expect.objectContaining({ online: false, playerCount: 0 }) },
    ]);
    expect(bare.server).not.toHaveBeenCalled();
    bare.hub.close();
  });
});
