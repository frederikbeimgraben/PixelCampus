import { expect, test } from '@playwright/test';

/**
 * The site with scripting off.
 *
 * This is not only a courtesy to visitors who block script. Every visitor is
 * in this state between the arrival of the page and the run of the bundle.
 * Angular replays a click made in that window, but not a key press. Anything
 * that must work then must work here.
 */
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('renders the page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Open PixelCampus' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Player Statistics' })).toBeVisible();
  });

  test('does not leave the loading screen covering it', async ({ page }) => {
    await page.goto('/');

    // Nothing is running to take it down, so this is the stylesheet's own
    // backstop firing; it is deliberately slower than any ordinary load.
    await expect(page.locator('app-loading-screen .screen')).toBeHidden({ timeout: 15_000 });
  });

  test('opens an entry with the keyboard', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Open Player Statistics' }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/stats$/);
  });

  test('opens an entry with the pointer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-loading-screen .screen')).toBeHidden({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Open Player Statistics' }).click();

    await expect(page).toHaveURL(/\/stats$/);
  });
});
