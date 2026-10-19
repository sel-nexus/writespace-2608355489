/** Run discovery journeys against the built SPA on desktop and mobile. */
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const host = env.PREVIEW_HOST || '127.0.0.1';
const port = env.PREVIEW_PORT || '4173';
const baseURL = env.TEST_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview',
    url: baseURL,
    env: { PREVIEW_HOST: host, PREVIEW_PORT: port },
    reuseExistingServer: false,
  },
});
