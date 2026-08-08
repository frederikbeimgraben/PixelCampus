import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';

import { API_BASE_PATH } from '../contract/index.js';
import type { Config } from '../config.js';
import type { LiveHub, LiveSubscriber } from '../domain/live-hub.js';
import { LIVE_PATH, LiveCommandSchema, type LiveEvent } from '../domain/models.js';

/** Longest command a client may send. A watch is well under 200 bytes. */
const MAX_PAYLOAD_BYTES = 1024;

/** 1013 Try Again Later, sent when the connection limit is reached. */
const TRY_AGAIN_LATER = 1013;

export interface LiveRouteOptions {
  readonly config: Config;
  readonly hub: LiveHub;
}

/**
 * The live-update socket.
 *
 * The socket is read-only and unauthenticated, like the rest of the API. It
 * defends only its own resources. It caps connections, limits the payload
 * size, and drops a client that stops answering the heartbeat.
 *
 * A connection costs one map entry until it watches a player. Watchers of the
 * same player share one upstream query.
 */
export async function liveRoutes(app: FastifyInstance, options: LiveRouteOptions): Promise<void> {
  const { config, hub } = options;

  await app.register(websocket, {
    options: { maxPayload: MAX_PAYLOAD_BYTES },
  });

  app.get(`${API_BASE_PATH}${LIVE_PATH}`, { websocket: true }, (socket, request) => {
    if (hub.size >= config.LIVE_MAX_CLIENTS) {
      socket.close(TRY_AGAIN_LATER, 'Too many listeners');
      return;
    }

    const subscriber: LiveSubscriber = {
      send: (event: LiveEvent) => {
        // A socket closing between a read and its push is ordinary, not an error.
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event));
      },
    };

    hub.add(subscriber);

    /*
     * A client can vanish without closing, after a closed laptop lid or a
     * dropped mobile connection. The socket never fires 'close' and the hub
     * entry stays. Ping the client and drop it after two missed rounds.
     */
    let answered = true;
    socket.on('pong', () => {
      answered = true;
    });

    const heartbeat = setInterval(() => {
      if (!answered) {
        socket.terminate();
        return;
      }

      answered = false;
      socket.ping();
    }, config.LIVE_PING_SECONDS * 1000);
    heartbeat.unref();

    socket.on('message', (raw: Buffer) => {
      const command = LiveCommandSchema.safeParse(parse(raw));

      if (!command.success) {
        subscriber.send({ type: 'error', message: 'Unrecognized command' });
        return;
      }

      hub.watch(subscriber, command.data.player);
    });

    socket.on('close', () => {
      clearInterval(heartbeat);
      hub.remove(subscriber);
    });

    socket.on('error', (error: Error) => {
      request.log.debug({ err: error }, 'live socket error');
      clearInterval(heartbeat);
      hub.remove(subscriber);
    });
  });
}

function parse(raw: Buffer): unknown {
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }
}
