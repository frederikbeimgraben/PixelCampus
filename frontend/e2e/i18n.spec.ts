import { expect, test } from './fixtures/api';

test.describe('language', () => {
  test('starts in English when the browser prefers it', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Open Player Statistics' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('switches to German and back', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'DE', exact: true }).click();

    await expect(page.getByRole('link', { name: 'Spielerstatistik öffnen' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open Player Statistics' })).toBeVisible();
  });

  test('remembers the choice across a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'DE', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('link', { name: 'Spielerstatistik öffnen' })).toBeVisible();
  });

  test('translates the statistics page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'DE', exact: true }).click();
    await page.goto('/stats');

    await expect(page.getByRole('heading', { name: 'Spielerstatistik' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Spielzeit' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Spieler' })).toBeAttached();
  });

  test('translates the gear panel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'DE', exact: true }).click();
    await page.goto('/stats/Notch');

    await expect(page.getByRole('heading', { name: 'Ausrüstung' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Statistik' })).toBeVisible();
  });

  test('follows a German browser preference with no stored choice', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'de-DE' });
    const page = await context.newPage();

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');

    await context.close();
  });
});
