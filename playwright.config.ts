import { defineConfig, devices } from '@playwright/test';

const localBaseURL = 'http://127.0.0.1:5173';
const baseURL = process.env.E2E_BASE_URL ?? localBaseURL;
const shouldStartLocalWebServer = process.env.E2E_BASE_URL === undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  timeout: process.env.CI ? 60_000 : 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  expect: {
    timeout: process.env.CI ? 10_000 : 5_000,
  },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  ...(shouldStartLocalWebServer
    ? {
        webServer: {
          command: 'pnpm dev --host 127.0.0.1 --port 5173',
          url: localBaseURL,
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
