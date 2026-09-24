// Pruebas contra un proyecto real de Supabase (no se ejecutan con npm run test).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/supabase/**/*.test.ts'], testTimeout: 30_000, fileParallelism: false }
});
