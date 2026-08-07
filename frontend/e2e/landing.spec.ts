import { expect, test } from './fixtures/api';

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the server banner with live status', async ({ page }) => {
    const server = page.getByRole('button', { name: 'Open PixelCampus' });

    await expect(server).toBeVisible();
    await expect(server).toContainText('PixelCampus');
    // 12 of 60: the count comes from the socket, which overrides the ping's 3.
    await expect(server).toContainText('12');
    await expect(server).toContainText('60');
  });

  test('lists every navigator entry', async ({ page }) => {
    for (const name of ['PixelCampus', 'Player Statistics', 'LiveMap', 'Discord']) {
      await expect(page.getByRole('button', { name: `Open ${name}` })).toBeVisible();
    }
  });

  test('hides the wiki entry until the external wiki exists', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open Wiki' })).toHaveCount(0);
  });

  test('opens the connection details and copies the address', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByRole('button', { name: 'Open PixelCampus' }).click();

    await expect(page.getByRole('heading', { name: 'How to Connect' })).toBeVisible();

    await page.getByRole('button', { name: 'Copy the server address' }).click();
    await expect(page.getByRole('button', { name: 'Copy the server address' })).toContainText(
      'copied',
    );

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('pixelcampus.space');
  });

  test('goes back from the connection details', async ({ page }) => {
    await page.getByRole('button', { name: 'Open PixelCampus' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Open LiveMap' })).toBeVisible();
  });

  test('navigates to the statistics page', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Player Statistics' }).click();

    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByRole('heading', { name: 'Player Statistics' })).toBeVisible();
  });

  test('opens an entry with the keyboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Open Player Statistics' }).focus();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/stats$/);
  });

  test('renders when the server is unreachable', async ({ page }) => {
    await page.route('**/api/minecraft/status', (route) => route.abort());
    await page.goto('/');

    // The banner must still appear; the counters read as unknown.
    const server = page.getByRole('button', { name: 'Open PixelCampus' });
    await expect(server).toBeVisible();
    await expect(server).toContainText('???');
  });
});
