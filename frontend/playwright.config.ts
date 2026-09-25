import { defineConfig, devices } from '@playwright/test';

// Not Angular's default 4200: with reuseExistingServer, any other Angular dev
// server already on that port gets adopted and the whole suite silently tests
// somebody else's application.
const PORT = Number(process.env['PC_E2E_PORT'] ?? 4273);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // NixOS cannot run the dynamically linked browsers Playwright downloads.
    // Point PLAYWRIGHT_CHROMIUM_PATH at a system browser, or set
    // PLAYWRIGHT_BROWSERS_PATH to nixpkgs' playwright-driver.browsers, whose
    // version must match @playwright/test.
    launchOptions: process.env['PLAYWRIGHT_CHROMIUM_PATH']
      ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] }
      : {},
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: `npm start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    env: {
      // The doubles intercept in the browser, so nothing should reach the dev
      // server's /api proxy. Aiming it at a closed port keeps a request that
      // slips through -- one issued as a test tears its page down, say -- from
      // going out to the real hosts.
      PC_DEV_API_TARGET: 'http://127.0.0.1:1',

      // Server-side rendering fetches before the browser exists, so the doubles
      // cannot intercept it. Aimed at a closed port it fails at once, the page
      // renders its empty state, and the browser then fetches for itself and
      // gets the doubles. What the tests assert is the hydrated page.
      PC_SSR_API_URL: 'http://127.0.0.1:1',
    },
  },
});
