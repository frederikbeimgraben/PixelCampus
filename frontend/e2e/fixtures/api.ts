import { test as base, type Page } from '@playwright/test';

/**
 * Backend doubles.
 *
 * The tests must not depend on the live server: it goes offline and its player
 * counts move. Every upstream call is intercepted, so a failure means the front
 * end broke.
 */

const API = 'https://api.pixelcampus.space';

/**
 * The classic default skin, shipped with the app. Relative to the working
 * directory, which is the package root where playwright.config.ts lives.
 */
const STEVE_SKIN = 'public/assets/player/wide_steve.png';

export const SERVER_STATUS = {
  data: {
    latency: 42,
    status: {
      description: {
        extra: [
          { text: 'PixelCampus', color: 'green', bold: true },
          { text: 'Fachschaft Informatik', color: 'gray', italic: true },
        ],
      },
      players: { online: 3, max: 60, sample: [{ name: 'Alex' }, { name: 'Steve' }] },
      version: { name: 'Purpur 26.2' },
    },
  },
};

export const LEADERBOARD = {
  metric: 'playtime',
  total: 2,
  generatedAt: '2026-08-06T12:00:00.000Z',
  entries: [
    {
      rank: 1,
      uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
      name: 'Notch',
      value: 356_400_000,
      unit: 'ms',
      online: true,
    },
    {
      rank: 2,
      uuid: '853c80ef-3c37-49fd-aa49-938b674adae6',
      name: 'Jeb_',
      value: 90_000_000,
      unit: 'ms',
      online: false,
    },
  ],
};

export const PROFILE = {
  uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5',
  name: 'Notch',
  online: true,
  health: 20,
  hunger: 18,
  experienceProgress: 0.65,
  stats: {
    playtimeMs: 356_400_000,
    kills: 128,
    deaths: 17,
    blocksMined: 94_012,
    blocksPlaced: 41_338,
    distanceTravelledBlocks: 812_400,
    sessions: 214,
    firstSeen: '2024-03-01T10:00:00.000Z',
    lastSeen: '2026-08-06T09:30:00.000Z',
  },
  gear: {
    helmet: {
      id: 'minecraft:diamond_helmet',
      name: 'Diamond Helmet',
      amount: 1,
      enchantments: ['Protection IV'],
      durability: 0.82,
    },
    chestplate: {
      id: 'minecraft:netherite_chestplate',
      name: 'Netherite Chestplate',
      amount: 1,
      enchantments: [],
      durability: 0.95,
    },
    leggings: null,
    boots: {
      id: 'minecraft:leather_boots',
      name: 'Leather Boots',
      amount: 1,
      enchantments: ['Feather Falling IV'],
      durability: 0.4,
    },
    mainHand: {
      id: 'minecraft:mace',
      name: 'Mace',
      amount: 1,
      enchantments: ['Density V'],
      durability: 0.7,
    },
    offHand: {
      id: 'minecraft:shield',
      name: 'Shield',
      amount: 1,
      enchantments: [],
      durability: 1,
    },
  },
};

/** 1x1 transparent PNG, standing in for flat renders and server icons. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Installs the default doubles for every upstream the app calls. */
export async function mockApi(page: Page): Promise<void> {
  await page.route(`${API}/api/minecraft/status`, (route) =>
    route.fulfill({ json: SERVER_STATUS }),
  );

  await page.route(`${API}/api/minecraft/icon.png`, (route) =>
    route.fulfill({ body: PIXEL_PNG, contentType: 'image/png' }),
  );

  await page.route(`${API}/api/v1/leaderboard*`, (route) => {
    const metric = new URL(route.request().url()).searchParams.get('metric') ?? 'playtime';
    return route.fulfill({ json: { ...LEADERBOARD, metric } });
  });

  await page.route(`${API}/api/v1/players/*/skin/*`, (route) => {
    const view = new URL(route.request().url()).pathname.split('/').pop();

    // The 3D viewer parses the texture and rejects anything not skin-shaped,
    // so the raw view serves the real default skin from the asset set.
    return view === 'texture'
      ? route.fulfill({ path: STEVE_SKIN, contentType: 'image/png' })
      : route.fulfill({ body: PIXEL_PNG, contentType: 'image/png' });
  });

  await page.route(`${API}/api/v1/players/*`, (route) => {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');

    return name === 'Notch' || name === PROFILE.uuid
      ? route.fulfill({ json: PROFILE })
      : route.fulfill({ status: 404, json: { error: 'Not found' } });
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockApi(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
