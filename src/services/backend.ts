/* Crea la autenticación y el almacenamiento según config.mode. */
import { config } from '../config';
import type { AuthUser } from '../domain/types';
import { DemoAuth } from './auth/demoAuth';
import { SupabaseAuth } from './auth/supabaseAuth';
import type { Auth } from './auth/types';
import { LocalStore } from './storage/localStore';
import type { Store } from './storage/types';
import type { CoachService } from './coach';
import { LocalOwnPrograms, type OwnPrograms } from './ownPrograms';
import type { AiImporter } from './aiImport';

export interface Backend {
  auth: Auth;
  createStore(user: AuthUser): Store;
  /** Entrenador y alumnos: solo con Supabase. */
  createCoach?(user: AuthUser): CoachService;
  /** Rutinas propias de la persona. Sin él se guardan en este dispositivo. */
  createOwnPrograms?(user: AuthUser): OwnPrograms;
  /** Leer rutinas de fotos, PDF o texto con IA: solo con Supabase. */
  createAiImporter?(user: AuthUser): AiImporter;
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
    const [{ createClient }, { SupabaseStore }, { OfflineStore }, { CoachService: Coach }, { SupabaseOwnPrograms }, { SupabaseAiImporter }] = await Promise.all([
      import('@supabase/supabase-js'),
      import('./storage/supabaseStore'),
      import('./storage/offlineStore'),
      import('./coach'),
      import('./ownPrograms'),
      import('./aiImport')
    ]);
    const client = createClient(config.supabase.url, config.supabase.anonKey);
    // Copia local + cola: se puede entrenar sin conexión y se sincroniza al volver
    return {
      auth: new SupabaseAuth(client),
      createStore: u => new OfflineStore(new SupabaseStore(client, u.id), u.id),
      createCoach: u => new Coach(client, u.id),
      createOwnPrograms: u => new SupabaseOwnPrograms(client, u.id),
      createAiImporter: u => new SupabaseAiImporter(client, u.id)
    };
  }
  return { auth: new DemoAuth(), createStore: u => new LocalStore(u.id), createOwnPrograms: u => new LocalOwnPrograms(u.id) };
}
