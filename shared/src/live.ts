import { z } from 'zod';

import { PlayerProfileSchema, ServerInfoSchema } from './models.js';

/**
 * The live-update protocol, defined once for both sides.
 *
 * Server state and player presence change while a page is open. Polling made
 * every open tab query the game server on a timer. The socket inverts that.
 * The API reads once for as long as somebody listens, and pushes only changes.
 *
 * This is not part of the oRPC contract, which covers request and response
 * endpoints. The messages are zod schemas, so both sides derive their types
 * from them and check what they receive.
 */

/** Path of the socket, relative to API_BASE_PATH. */
export const LIVE_PATH = '/live';

/**
 * Client to server. A watch replaces the previous watch on that connection.
 *
 * There is no unsubscribe. To watch another player, send another watch. To
 * stop, send a null one.
 */
export const LiveCommandSchema = z.object({
  type: z.literal('watch'),
  player: z.string().min(1).max(64).nullable(),
});
export type LiveCommand = z.infer<typeof LiveCommandSchema>;

/**
 * The parts of a profile that change while it is on screen.
 *
 * Statistics are left out. They come from a different upstream and move
 * slowly, so every tick would cost a second query.
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
