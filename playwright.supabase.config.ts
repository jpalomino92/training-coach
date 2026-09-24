// Pruebas de extremo a extremo con la app conectada a Supabase (npm run test:e2e:supabase).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e-supabase',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { ...devices['Pixel 5'], baseURL: 'http://localhost:5174', locale: 'es-ES', timezoneId: 'Europe/Madrid', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev:supabase -- --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, timeout: 60_000 }
});
