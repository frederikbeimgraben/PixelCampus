import { describe, expect, it } from 'vitest';

import {
  LeaderboardSchema,
  MetricSchema,
  PlayerProfileSchema,
  ServerInfoSchema,
  contract,
} from '../src/index.js';

/*
 * These guard the thing the contract exists for: that both sides agree on the
 * wire shape. A change that breaks one of these breaks the front end too.
 */

const PROFILE = {
  uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
  name: 'Notch',
  online: true,
  stats: {
    playtimeMs: 356_400_000,
    kills: 128,
    deaths: 17,
    sessions: 214,
    firstSeen: '2024-03-01T10:00:00.000Z',
    lastSeen: '2026-08-06T09:30:00.000Z',
  },
};

describe('contract', () => {
  it('exposes the endpoints the front end calls', () => {
    expect(Object.keys(contract).sort()).toEqual(['health', 'leaderboard', 'player', 'server']);
  });
});

describe('PlayerProfileSchema', () => {
  it('accepts a full profile', () => {
    expect(PlayerProfileSchema.parse(PROFILE).name).toBe('Notch');
  });

  it('rejects a timestamp that is not ISO', () => {
    const broken = { ...PROFILE, stats: { ...PROFILE.stats, lastSeen: 'yesterday' } };
    expect(PlayerProfileSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a missing field rather than passing undefined through', () => {
    const { online: _omitted, ...withoutOnline } = PROFILE;
    expect(PlayerProfileSchema.safeParse(withoutOnline).success).toBe(false);
  });
});

describe('LeaderboardSchema', () => {
  it('accepts an empty board', () => {
    const board = {
      metric: 'playtime',
      entries: [],
      total: 0,
      generatedAt: '2026-08-06T12:00:00.000Z',
    };
    expect(LeaderboardSchema.parse(board).total).toBe(0);
  });

  it('rejects an unknown metric', () => {
    expect(MetricSchema.safeParse('bogus').success).toBe(false);
  });

  it('rejects a rank below one', () => {
    const board = {
      metric: 'kills',
      entries: [{ rank: 0, uuid: 'x', name: 'y', value: 1, unit: 'count', online: false }],
      total: 1,
      generatedAt: '2026-08-06T12:00:00.000Z',
    };
    expect(LeaderboardSchema.safeParse(board).success).toBe(false);
  });
});

describe('ServerInfoSchema', () => {
  const SERVER = {
    name: 'PixelCampus',
    motd: 'PixelCampus',
    version: 'Paper 1.21.4',
    online: true,
    playerCount: 1,
    maxPlayerCount: 20,
    players: ['Notch'],
  };

  it('accepts a server without the MOTD tree and the latency', () => {
    // The shape before both fields existed. A client built against it must
    // still parse what the API sends, and the other way round.
    expect(ServerInfoSchema.safeParse(SERVER).success).toBe(true);
  });

  it('passes the MOTD tree through as the server sent it', () => {
    const description = { text: '', extra: [{ text: 'Pixel', color: 'aqua', bold: true }] };
    const parsed = ServerInfoSchema.parse({ ...SERVER, description, latencyMs: 12 });

    expect(parsed.description).toEqual(description);
    expect(parsed.latencyMs).toBe(12);
  });

  it('rejects a negative latency', () => {
    expect(ServerInfoSchema.safeParse({ ...SERVER, latencyMs: -1 }).success).toBe(false);
  });
});
