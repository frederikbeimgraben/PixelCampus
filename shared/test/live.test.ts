import { describe, expect, it } from 'vitest';

import { LiveCommandSchema, LiveEventSchema, LivePlayerSchema } from '../src/index.js';

/*
 * The socket carries no request/response pairing to fall back on: a message
 * either parses into one of these or is dropped. These guard that both sides
 * agree on which shapes those are.
 */

const LIVE_PLAYER = {
  uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
  name: 'Notch',
  online: true,
};

describe('LiveCommandSchema', () => {
  it('accepts a watch on a player', () => {
    expect(LiveCommandSchema.parse({ type: 'watch', player: 'Notch' }).player).toBe('Notch');
  });

  it('accepts a watch on nobody', () => {
    expect(LiveCommandSchema.safeParse({ type: 'watch', player: null }).success).toBe(true);
  });

  it('rejects a name longer than any Minecraft name', () => {
    const command = { type: 'watch', player: 'x'.repeat(65) };
    expect(LiveCommandSchema.safeParse(command).success).toBe(false);
  });

  it('rejects an unknown command', () => {
    expect(LiveCommandSchema.safeParse({ type: 'subscribe' }).success).toBe(false);
  });
});

describe('LivePlayerSchema', () => {
  it('carries no statistics, which the socket does not re-send', () => {
    expect(Object.keys(LivePlayerSchema.shape)).not.toContain('stats');
  });

  it('accepts a live reading', () => {
    expect(LivePlayerSchema.parse(LIVE_PLAYER).name).toBe('Notch');
  });
});

describe('LiveEventSchema', () => {
  it('accepts a player update', () => {
    const event = { type: 'player', player: LIVE_PLAYER };
    expect(LiveEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts a failure to read one', () => {
    expect(LiveEventSchema.safeParse({ type: 'error', message: 'nope' }).success).toBe(true);
  });

  it('rejects an event with no type to discriminate on', () => {
    expect(LiveEventSchema.safeParse({ player: LIVE_PLAYER }).success).toBe(false);
  });
});
