import { describe, expect, it } from 'vitest';

import { PlanAdapter } from '../src/adapters/plan.js';
import { loadConfig } from '../src/config.js';

/*
 * PLAN 5.8 serves its own dashboard, so /v1/players is a DataTables payload:
 * rows under `data`, values as { v: raw, d: "display" }. Shapes below come from
 * a live PLAN 5.8 build 3579.
 */

const PLAN_PLAYERS_PAYLOAD = {
  timestamp: 1786044958245,
  timestamp_f: 'Today, 19:35',
  columns: [{ data: 'name', title: 'Name' }],
  data: [
    {
      // Verbatim from PLAN: the name is a link, and the row has no uuid field.
      name: '<a class="link" href="./player/6035c7d9-0654-332b-89c2-5ff4218935e2">StatBot</a>',
      sessions: '12',
      activePlaytime: { d: '4d 3h', v: '356400000' },
      index: { d: '1.5 (Active)', v: '1.5' },
      registered: { d: '1 Jan 2025', v: '1735689600000' },
      seen: { d: 'Today', v: '1786044900000' },
      geolocation: 'Germany',
    },
  ],
};

/** Reaches the private parsing path through a stubbed fetch. */
async function playersFrom(payload: unknown) {
  const config = loadConfig({ PLAN_URL: 'http://plan.test' } as NodeJS.ProcessEnv);
  const adapter = new PlanAdapter(config);

  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;

  try {
    return await adapter.players();
  } finally {
    globalThis.fetch = original;
  }
}

describe('PlanAdapter', () => {
  it('reads rows out of the DataTables envelope', async () => {
    const players = await playersFrom(PLAN_PLAYERS_PAYLOAD);

    expect(players).toHaveLength(1);
  });

  it('takes the name out of the anchor PLAN wraps it in', async () => {
    const players = await playersFrom(PLAN_PLAYERS_PAYLOAD);

    expect(players[0]?.name).toBe('StatBot');
  });

  it('recovers the uuid from the link, the only place it appears', async () => {
    const players = await playersFrom(PLAN_PLAYERS_PAYLOAD);

    expect(players[0]?.uuid).toBe('6035c7d9-0654-332b-89c2-5ff4218935e2');
  });

  it('unwraps the raw value from a { v, d } cell', async () => {
    const players = await playersFrom(PLAN_PLAYERS_PAYLOAD);

    // Not the "4d 3h" display string, and a numeric string becomes a number.
    expect(players[0]?.stats.playtimeMs).toBe(356_400_000);
    expect(players[0]?.stats.sessions).toBe(12);
  });

  it('converts timestamps to ISO dates', async () => {
    const players = await playersFrom(PLAN_PLAYERS_PAYLOAD);

    // Epoch milliseconds arrive as a string; new Date(string) would be invalid.
    expect(players[0]?.stats.firstSeen).toBe('2025-01-01T00:00:00.000Z');
    expect(players[0]?.stats.lastSeen).toBe('2026-08-06T19:35:00.000Z');
  });

  it('reports zero for statistics this payload does not carry', async () => {
    const players = await playersFrom(PLAN_PLAYERS_PAYLOAD);

    expect(players[0]?.stats.kills).toBe(0);
    expect(players[0]?.stats.blocksMined).toBe(0);
  });

  it('accepts a bare array', async () => {
    const players = await playersFrom([{ name: 'Alex', playtime: 1000 }]);

    expect(players[0]?.name).toBe('Alex');
  });

  it('returns nothing for an empty table', async () => {
    expect(await playersFrom({ data: [] })).toEqual([]);
  });

  it('skips rows with neither a name nor a uuid', async () => {
    expect(await playersFrom({ data: [{ sessions: 3 }] })).toEqual([]);
  });
});
