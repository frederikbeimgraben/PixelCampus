import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/api';

/**
 * Reveals the page list using whichever affordance the layout offers: a toggle
 * button on touch layouts, hover on pointer layouts.
 */
async function openNavigator(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Toggle the page list' });

  if (await toggle.isVisible()) {
    await toggle.click();
  } else {
    await page.getByRole('navigation', { name: 'Wiki pages' }).hover();
  }
}

test.describe('wiki', () => {
  test('renders the first page once loading finishes', async ({ page }) => {
    await page.goto('/wiki');

    await expect(page.getByRole('heading', { name: 'Wiki Home' })).toBeVisible();
    await expect(page.getByText('Welcome to the')).toBeVisible();
  });

  test('lists every page in the navigator', async ({ page }) => {
    await page.goto('/wiki');
    await expect(page.getByRole('heading', { name: 'Wiki Home' })).toBeVisible();

    await openNavigator(page);

    const nav = page.getByRole('navigation', { name: 'Wiki pages' });
    for (const title of ['Wiki Home', 'Rules', 'Getting Started']) {
      await expect(nav.getByRole('button', { name: title })).toBeVisible();
    }
  });

  test('switches page and records it in the URL', async ({ page }) => {
    await page.goto('/wiki');
    await expect(page.getByRole('heading', { name: 'Wiki Home' })).toBeVisible();

    await openNavigator(page);
    await page
      .getByRole('navigation', { name: 'Wiki pages' })
      .getByRole('button', { name: 'Rules' })
      .click();

    await expect(page.getByRole('heading', { name: 'Rules' })).toBeVisible();
    await expect(page).toHaveURL(/#rules$/);
  });

  test('opens the page named by the URL fragment', async ({ page }) => {
    await page.goto('/wiki#getting-started');

    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
  });

  test('marks outbound links noopener', async ({ page }) => {
    await page.goto('/wiki#rules');

    const link = page.getByRole('link', { name: 'Read more' });
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('stays usable when the wiki API fails', async ({ page }) => {
    await page.route('**/api/wiki', (route) => route.abort());
    await page.goto('/wiki');

    await expect(page.getByText('Loading the wiki...')).toBeVisible();
  });
});
