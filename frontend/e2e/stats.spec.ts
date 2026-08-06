import { PROFILE, expect, test } from './fixtures/api';

test.describe('leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stats');
  });

  test('ranks players and formats their playtime', async ({ page }) => {
    const rows = page.getByRole('row');

    // Header plus the two mocked players.
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText('Notch');
    // 356_400_000 ms is 4 days 3 hours.
    await expect(rows.nth(1)).toContainText('4d 3h');
    await expect(rows.nth(2)).toContainText('Jeb_');
  });

  test('shows a skin head per row', async ({ page }) => {
    const heads = page.locator('img.head');

    await expect(heads).toHaveCount(2);
    await expect(heads.first()).toHaveAttribute('src', /\/skin\/head/);
  });

  test('switches metric', async ({ page }) => {
    await page.getByRole('tab', { name: 'Kills' }).click();

    await expect(page.getByRole('tab', { name: 'Kills' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('columnheader', { name: 'Kills' })).toBeVisible();
  });

  test('opens a player profile', async ({ page }) => {
    await page.getByRole('button', { name: 'Notch' }).click();

    await expect(page).toHaveURL(/\/stats\/Notch$/);
    await expect(page.getByRole('heading', { name: 'Gear' })).toBeVisible();
  });

  test('reports a failing statistics service', async ({ page }) => {
    await page.route('**/api/v1/leaderboard*', (route) => route.abort());
    await page.goto('/stats');

    await expect(page.getByText('could not be reached')).toBeVisible();
  });
});

test.describe('player profile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stats/Notch');
  });

  test('shows the skin and presence', async ({ page }) => {
    // Either the 3D canvas or, where WebGL is unavailable, the flat render.
    await expect(page.getByRole('img', { name: 'Skin of Notch' })).toBeVisible();
    await expect(page.getByText('Online', { exact: true })).toBeVisible();
  });

  test('renders the skin in 3D', async ({ page }) => {
    const canvas = page.locator('app-player-skin canvas.viewer');

    await expect(canvas).toBeVisible();
    // The viewer only reveals the canvas once it has drawn a frame.
    await expect(canvas).toHaveClass(/ready/);
  });

  test('shows every equipment slot, empty ones included', async ({ page }) => {
    const gear = page.locator('app-gear-slot');
    await expect(gear).toHaveCount(6);

    // Leggings are null in the fixture and must still render as an empty slot.
    await expect(page.locator('app-gear-slot .slot.empty')).toHaveCount(1);
  });

  test('drops the gear column entirely when the player is offline', async ({ page }) => {
    // Gear is live state. An explanatory paragraph in its place widened the
    // column and squeezed the statistics table.
    await page.route('**/api/v1/players/Notch', (route) =>
      route.fulfill({ json: { ...PROFILE, online: false, gear: null } }),
    );
    await page.goto('/stats/Notch');

    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
    await expect(page.locator('app-gear-slot')).toHaveCount(0);
    await expect(page.locator('.gear-panel')).toHaveCount(0);
  });

  test('renders gear textures from the item set', async ({ page }) => {
    const mace = page.locator('app-gear-slot img.texture').first();

    await expect(mace).toHaveAttribute('src', /\/assets\/items\//);
  });

  test('lists the statistics', async ({ page }) => {
    await expect(page.getByText('Playtime')).toBeVisible();
    await expect(page.getByText('4d 3h')).toBeVisible();
    await expect(page.getByText('128')).toBeVisible();
    // 128 kills over 17 deaths.
    await expect(page.getByText('7.53')).toBeVisible();
  });

  test('returns to the leaderboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Leaderboard' }).click();

    await expect(page).toHaveURL(/\/stats$/);
  });

  test('reports an unknown player', async ({ page }) => {
    await page.goto('/stats/Nobody');

    await expect(page.getByText('No profile was found')).toBeVisible();
  });
});
