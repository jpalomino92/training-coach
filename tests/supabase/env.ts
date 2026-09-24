/* Datos de las cuentas fijas de prueba (.env.supabase.local, no se sube al repositorio). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const env: Record<string, string> = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.supabase.local'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const BASE = env.SUPABASE_TEST_EMAIL || '';
export const TEST_PASSWORD = env.SUPABASE_TEST_PASSWORD || '';
if (!/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(BASE) || TEST_PASSWORD.length < 12) {
  throw new Error('Faltan SUPABASE_TEST_EMAIL (sin +) o SUPABASE_TEST_PASSWORD en .env.supabase.local');
}

export type Tag = 'test-a' | 'test-b';
/** "support@dominio" → "support+test-a@dominio" */
export const testEmail = (tag: Tag) => BASE.replace('@', `+${tag}@`);
