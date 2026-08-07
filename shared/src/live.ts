import { z } from 'zod';

import { PlayerProfileSchema, ServerInfoSchema } from './models.js';

/**
 * The live-update protocol, defined once for both sides.
 *
 * Server state and player presence change while a page is open, and polling for
 * them meant every visitor's tab queried the game server on a timer. A socket
 * inverts that: the API polls once, for as long as somebody is listening, and
 * pushes only what changed.
 *
 * This is deliberately not part of the oRPC contract, which describes
 * request/response endpoints. The messages are still zod schemas, so both sides
 * derive their types from these and validate what they receive.
 */

/** Where the socket lives, relative to API_BASE_PATH. */
export const LIVE_PATH = '/live';

/**
 * Client to server. A watch replaces whatever the connection watched before, so
 * there is nothing to unsubscribe: navigating to another player sends another
 * watch, and leaving the page sends a null one.
 */
export const LiveCommandSchema = z.object({
  type: z.literal('watch'),
  player: z.string().min(1).max(64).nullable(),
});
export type LiveCommand = z.infer<typeof LiveCommandSchema>;

/**
 * The parts of a profile that change while it is on screen. Statistics are
 * excluded: they come from a different upstream, move slowly, and would make
 * every tick a second query.
 */
export const LivePlayerSchema = PlayerProfileSchema.omit({ stats: true });
export type LivePlayer = z.infer<typeof LivePlayerSchema>;

/** Server to client. */
export const LiveEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('server'), server: ServerInfoSchema }),
  z.object({ type: z.literal('player'), player: LivePlayerSchema }),
  /** The watched player is unknown, or an upstream refused. Not fatal. */
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type LiveEvent = z.infer<typeof LiveEventSchema>;
