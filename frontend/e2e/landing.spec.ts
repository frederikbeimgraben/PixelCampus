import { expect, test } from './fixtures/api';

test.describe('landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the server banner with live status', async ({ page }) => {
    const server = page.getByRole('button', { name: 'Open PixelCampus' });

    await expect(server).toBeVisible();
    await expect(server).toContainText('PixelCampus');
    // 3 of 60 online, from the mocked ping.
    await expect(server).toContainText('3');
    await expect(server).toContainText('60');
  });

  test('lists every navigator entry', async ({ page }) => {
    for (const name of ['PixelCampus', 'Player Statistics', 'LiveMap', 'Discord', 'Wiki']) {
      await expect(page.getByRole('button', { name: `Open ${name}` })).toBeVisible();
    }
  });

  test('opens the connection details and copies the address', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // First click selects, second opens, as in the Minecraft server list.
    const server = page.getByRole('button', { name: 'Open PixelCampus' });
    await server.click();
    await server.click();

    await expect(page.getByRole('heading', { name: 'How to Connect' })).toBeVisible();

    await page.getByRole('button', { name: 'Copy the server address' }).click();
    await expect(page.getByRole('button', { name: 'Copy the server address' })).toContainText(
      'copied',
    );

    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('pixelcampus.space');
  });

  test('goes back from the connection details', async ({ page }) => {
    const server = page.getByRole('button', { name: 'Open PixelCampus' });
    await server.click();
    await server.click();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('button', { name: 'Open LiveMap' })).toBeVisible();
  });

  test('navigates to the statistics page', async ({ page }) => {
    const stats = page.getByRole('button', { name: 'Open Player Statistics' });
    await stats.click();
    await stats.click();

    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByRole('heading', { name: 'Player Statistics' })).toBeVisible();
  });

  test('opens an entry with the keyboard', async ({ page }) => {
    // Enter opens directly; there is no keyboard equivalent of a double click.
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
