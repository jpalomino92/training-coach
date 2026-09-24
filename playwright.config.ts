import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure'
  },
  projects: [
    // Móvil: Chromium con viewport, táctil y user agent de móvil
    { name: 'movil-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }, testIgnore: /visual/ },
    { name: 'movil-375', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 667 } }, testIgnore: /visual/ },
    { name: 'visual', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000
  }
});
