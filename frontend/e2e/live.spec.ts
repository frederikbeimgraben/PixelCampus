import type { WebSocketRoute } from '@playwright/test';

import { LIVE_SERVER, expect, test } from './fixtures/api';

/**
 * The live socket.
 *
 * The doubles make the socket disagree with the one-shot fetches on purpose, so
 * every assertion here fails if the page falls back to the fetched value.
 */
test.describe('live updates', () => {
  test('takes the banner player count from the socket', async ({ page }) => {
    await page.goto('/');

    const server = page.getByRole('button', { name: 'Open PixelCampus' });
    await expect(server).toContainText('12');
  });

  test('follows the count as it changes, without reloading', async ({ page }) => {
    // Held so the second push happens after the first has been asserted, rather
    // than on a timer that could beat the assertion to it.
    let connected!: (route: WebSocketRoute) => void;
    const live = new Promise<WebSocketRoute>((resolve) => (connected = resolve));

    await page.routeWebSocket('**/api/v1/live', (ws) => {
      ws.send(JSON.stringify({ type: 'server', server: LIVE_SERVER }));
      connected(ws);
    });

    await page.goto('/');

    const server = page.getByRole('button', { name: 'Open PixelCampus' });
    await expect(server).toContainText('12');

    // A player joins.
    (await live).send(
      JSON.stringify({ type: 'server', server: { ...LIVE_SERVER, playerCount: 13 } }),
    );

    await expect(server).toContainText('13');
  });

  test('falls back to the ping when the socket says nothing', async ({ page }) => {
    await page.routeWebSocket('**/api/v1/live', () => undefined);
    await page.goto('/');

    const server = page.getByRole('button', { name: 'Open PixelCampus' });
    await expect(server).toContainText('3');
  });

  test('marks a player online whom the fetched board called offline', async ({ page }) => {
    await page.goto('/stats');

    // Jeb_ is offline in LEADERBOARD and online in LIVE_SERVER.
    await expect(page.locator('tr.row', { hasText: 'Jeb_' })).toHaveClass(/online/);
  });

  test('takes health and hunger from the socket', async ({ page }) => {
    await page.goto('/stats/Notch');

    // The fetched profile says 20 and 18; the socket says 6 and 3.
    await expect(page.getByRole('img', { name: 'Health 6 / 20' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Hunger 3 / 20' })).toBeVisible();
  });

  test('stops watching a player when the page is left', async ({ page }) => {
    const watched: (string | null)[] = [];

    await page.routeWebSocket('**/api/v1/live', (ws) => {
      ws.onMessage((message) => {
        watched.push((JSON.parse(String(message)) as { player: string | null }).player);
      });
    });

    await page.goto('/stats/Notch');
    await expect(page.getByRole('heading', { name: 'Notch' })).toBeVisible();

    // Navigated in the app rather than reloaded: a reload takes the socket with
    // it, so there would be nothing left to send the unwatch on.
    await page.getByRole('button', { name: 'Leaderboard' }).click();

    await expect.poll(() => watched).toEqual(['Notch', null]);
  });
});
