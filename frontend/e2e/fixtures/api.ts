import { test as base, type Page } from '@playwright/test';

/**
 * Backend doubles.
 *
 * The tests must not depend on the live server. It goes offline and its player
 * counts move. These doubles intercept every upstream call, so a failure means
 * the front end broke.
 */

/**
 * Origin wildcard. The app calls the API on its own origin. That origin is the
 * dev server here and the deployed host in production. The wildcard also
 * matches a deployment that moves the API onto a host of its own.
 */
const API = '**';

/**
 * The classic default skin, shipped with the app. Relative to the working
 * directory, which is the package root where playwright.config.ts lives.
 */
const STEVE_SKIN = 'public/assets/player/wide_steve.png';

/** What `/api/v1/server` answers: the server information, with the MOTD tree. */
export const SERVER_STATUS = {
  name: 'PixelCampus',
  motd: 'PixelCampusFachschaft Informatik',
  version: 'Purpur 26.2',
  online: true,
  playerCount: 3,
  maxPlayerCount: 60,
  players: ['Alex', 'Steve'],
  description: {
    extra: [
      { text: 'PixelCampus', color: 'green', bold: true },
      { text: 'Fachschaft Informatik', color: 'gray', italic: true },
    ],
  },
  latencyMs: 42,
};

/**
 * What the live socket pushes on connect.
 *
 * Deliberately disagrees with SERVER_STATUS and LEADERBOARD: the counts differ,
 * and Jeb_ is online here but offline in the fetched board. A test that sees
 * these values is seeing the socket, not the one-shot fetch.
 */
export const LIVE_SERVER = {
  name: 'PixelCampus',
  motd: 'Fachschaft Informatik',
  version: 'Purpur 26.2',
  online: true,
  playerCount: 12,
  maxPlayerCount: 60,
  players: ['Notch', 'Jeb_'],
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
  gearCapturedAt: '2026-08-06T09:30:00.000Z',
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

/** The live view of PROFILE: same player, but hurt and holding nothing. */
export const LIVE_PLAYER = {
  uuid: PROFILE.uuid,
  name: PROFILE.name,
  online: true,
  health: 6,
  hunger: 3,
  gear: PROFILE.gear,
  gearCapturedAt: PROFILE.gearCapturedAt,
};

/**
 * Stands in for the live socket.
 *
 * Without this the app keeps calling a socket that is not there. No test could
 * then tell a value that arrived over the socket from one that came with the
 * page.
 *
 * @param page Page to intercept.
 * @param player Fields to change in the watched player. Presence, vitals and
 *   gear come from the socket. A test that fulfils a profile with different
 *   values must repeat them here, or the socket overwrites them.
 */
export async function mockLiveSocket(
  page: Page,
  player: Partial<typeof LIVE_PLAYER> = {},
): Promise<void> {
  await page.routeWebSocket(`${API}/api/v1/live`, (ws) => {
    ws.send(JSON.stringify({ type: 'server', server: LIVE_SERVER }));

    ws.onMessage((message) => {
      const command: unknown = JSON.parse(String(message));

      if (isWatch(command) && command.player !== null) {
        ws.send(JSON.stringify({ type: 'player', player: { ...LIVE_PLAYER, ...player } }));
      }
    });
  });
}

function isWatch(command: unknown): command is { type: 'watch'; player: string | null } {
  return (
    typeof command === 'object' &&
    command !== null &&
    (command as { type?: unknown }).type === 'watch'
  );
}

/** Installs the default doubles for every upstream the app calls. */
export async function mockApi(page: Page): Promise<void> {
  await mockLiveSocket(page);

  await page.route(`${API}/api/v1/server`, (route) => route.fulfill({ json: SERVER_STATUS }));

  await page.route(`${API}/api/v1/server/icon.png`, (route) =>
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

    /*
     * Pages arrive rendered, so their text is on screen before the bundle
     * runs. These tests cover the working application, not that first frame.
     * Acting on the first frame is not the same. Event replay covers pointer
     * input but not keys, and a click replayed after a navigation is lost.
     *
     * Angular strips the hydration annotations as it adopts the DOM. Their
     * absence is the signal that it has finished.
     */
    const navigate = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await navigate(url, options);

      // Hydrated, and past the loading screen, which covers the page until the
      // sprites and fonts are in and would otherwise swallow the first click.
      await page.waitForFunction(
        () =>
          !document.querySelector('[ngh]') && !document.querySelector('app-loading-screen .screen'),
      );

      return response;
    };

    await use(page);
  },
});

export { expect } from '@playwright/test';
