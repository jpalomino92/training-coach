/* ==========================================================
   Configuración
   VITE_APP_MODE=demo     → cuentas y datos en localStorage de este dispositivo.
   VITE_APP_MODE=supabase → Supabase Auth + PostgreSQL con Row Level Security.
   Usa solo la clave pública "anon" (nunca la service_role).
   ========================================================== */

/** Nombre de la app. Es el único sitio donde se define. */
export const APP_NAME = 'THE Training coach';

/** Prefijo de las claves de almacenamiento local. */
export const STORAGE_PREFIX = 'fuerza:v1';

export type AppMode = 'demo' | 'supabase';

// En vite.config.ts (Node) import.meta.env no existe: solo se usa APP_NAME.
const env: Record<string, string | undefined> = import.meta.env ?? {};

export const config = {
  mode: (env.VITE_APP_MODE === 'supabase' ? 'supabase' : 'demo') as AppMode,
  supabase: {
    url: (env.VITE_SUPABASE_URL as string | undefined) || '',
    anonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''
  }
};
