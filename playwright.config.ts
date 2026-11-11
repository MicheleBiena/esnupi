import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173/esnupi/',
    trace: 'retain-on-failure',
    timezoneId: 'Europe/Rome',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) } }],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/esnupi/',
    reuseExistingServer: !process.env['CI'],
  },
});
