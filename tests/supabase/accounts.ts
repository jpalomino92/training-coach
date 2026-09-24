/* Cuentas fijas de prueba en el proyecto real de Supabase.
   Se crean una sola vez (Supabase limita los registros por hora) y se
   vacían antes de cada prueba. Datos en .env.supabase.local (no se sube). */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, TEST_PASSWORD, testEmail, type Tag } from './env';

export { TEST_PASSWORD, testEmail, type Tag };

export const newClient = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** Inicia sesión con la cuenta de prueba; si aún no existe, la crea. */
export async function ensureAccount(tag: Tag): Promise<{ c: SupabaseClient; id: string; email: string }> {
  const c = newClient();
  const email = testEmail(tag);
  const signIn = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signIn.data.session) return { c, id: signIn.data.user!.id, email };
  const up = await c.auth.signUp({ email, password: TEST_PASSWORD });
  if (up.error) throw new Error(`No se pudo crear ${email}: ${up.error.message}`);
  if (!up.data.session) throw new Error('Supabase no devolvió sesión: desactiva "Confirm email" en Authentication → Providers → Email.');
  return { c, id: up.data.user!.id, email };
}

/** Borra todos los datos de la cuenta (las series se borran en cascada con sus entrenamientos). */
export async function resetAccount(tag: Tag) {
  const acc = await ensureAccount(tag);
  for (const t of ['workouts', 'exercise_notes', 'body_weights', 'profiles']) {
    const r = await acc.c.from(t).delete().eq('user_id', acc.id);
    if (r.error) throw new Error(`reset ${t}: ${r.error.message}`);
  }
  return acc;
}
