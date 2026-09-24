/* Crea la autenticación y el almacenamiento según config.mode. */
import { config } from '../config';
import type { AuthUser } from '../domain/types';
import { DemoAuth } from './auth/demoAuth';
import { SupabaseAuth } from './auth/supabaseAuth';
import type { Auth } from './auth/types';
import { LocalStore } from './storage/localStore';
import type { Store } from './storage/types';

export interface Backend {
  auth: Auth;
  createStore(user: AuthUser): Store;
}

// Un solo cliente de Supabase por pestaña (React StrictMode ejecuta dos veces el arranque en desarrollo).
let cached: Promise<Backend> | null = null;

export function createBackend(): Promise<Backend> {
  cached ??= buildBackend();
  cached.catch(() => { cached = null; });
  return cached;
}

async function buildBackend(): Promise<Backend> {
  if (config.mode === 'supabase') {
    if (!config.supabase.url || !config.supabase.anonKey) {
      throw new Error('Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
    }
    const [{ createClient }, { SupabaseStore }, { OfflineStore }] = await Promise.all([
      import('@supabase/supabase-js'),
      import('./storage/supabaseStore'),
      import('./storage/offlineStore')
    ]);
    const client = createClient(config.supabase.url, config.supabase.anonKey);
    // Copia local + cola: se puede entrenar sin conexión y se sincroniza al volver
    return { auth: new SupabaseAuth(client), createStore: u => new OfflineStore(new SupabaseStore(client, u.id), u.id) };
  }
  return { auth: new DemoAuth(), createStore: u => new LocalStore(u.id) };
}
