import { defineConfig, devices } from '@playwright/test';

const PORT = 4420;

/**
 * E2E runs against the production build with a throwaway data directory.
 * `tests/e2e/setup.ts` creates the owner account before the server starts.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `node --no-warnings tests/e2e/setup.ts && node dist/server/entry.mjs`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: './.e2e-data', OWNER_PASSWORD: 'e2e-password-123', NODE_ENV: 'production', COOKIE_SECURE: 'false' },
  },
});
