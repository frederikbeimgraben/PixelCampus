import { expect, test } from '@playwright/test';

import { mockApi } from './fixtures/api';

/*
 * Not the fixture from ./fixtures/api: its page waits for the loading screen to
 * go before handing over, which is the thing being watched here.
 */
test.describe('loading screen', () => {
  test('is in the rendered html, before any script has run', async ({ request }) => {
    const body = await (await request.get('/')).text();

    expect(body).toContain('app-loading-screen');
    // Nothing has loaded yet at the moment the page is written.
    expect(body).toContain('aria-valuenow="0"');
  });

  test('covers the page until the sprites and fonts are in', async ({ page }) => {
    await mockApi(page);

    let hold = true;
    await page.route('**/assets/**', async (route) => {
      if (hold) await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    await page.goto('/', { waitUntil: 'commit' });

    const screen = page.locator('app-loading-screen .screen');
    await expect(screen).toBeVisible();

    hold = false;

    // Gone, not merely hidden: an overlay left behind would keep catching
    // clicks meant for the page.
    await expect(screen).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Open PixelCampus/ })).toBeVisible();
  });
});
