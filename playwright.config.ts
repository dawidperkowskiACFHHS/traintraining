import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 45000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5187',
    viewport: { width: 1440, height: 1000 },
    channel: 'msedge',
    launchOptions: { args: ['--disable-gpu-sandbox'] },
  },
  reporter: 'list',
  workers: 1,
});
