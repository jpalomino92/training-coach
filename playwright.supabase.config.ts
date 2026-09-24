// Pruebas de extremo a extremo con la app de producción (con service worker) conectada a Supabase.
// npm run test:e2e:supabase  (lee .env.supabase.local)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e-supabase',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: { ...devices['Pixel 5'], baseURL: 'http://localhost:5174', locale: 'es-ES', timezoneId: 'Europe/Madrid', trace: 'retain-on-failure' },
  webServer: { command: 'npx vite build --mode supabase --outDir dist-supabase && npx vite preview --outDir dist-supabase --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 180_000 }
});
