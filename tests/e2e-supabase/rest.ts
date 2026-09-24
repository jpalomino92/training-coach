/* Vacía una cuenta de prueba con la API REST de Supabase (sin supabase-js:
   el cargador de TypeScript de Playwright no puede importarlo en Node 22). */
import { env, TEST_PASSWORD, testEmail, type Tag } from '../supabase/env';

export { TEST_PASSWORD, testEmail };

const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

export async function resetAccount(tag: Tag) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail(tag), password: TEST_PASSWORD })
  });
  if (!res.ok) throw new Error(`No se pudo entrar con ${testEmail(tag)} (${res.status}). Ejecuta antes npm run test:supabase para crear las cuentas.`);
  const { access_token: token, user } = await res.json() as { access_token: string; user: { id: string } };
  for (const t of ['workouts', 'exercise_notes', 'body_weights', 'profiles']) {
    const r = await fetch(`${URL}/rest/v1/${t}?user_id=eq.${user.id}`, { method: 'DELETE', headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`reset ${t}: ${r.status} ${await r.text()}`);
  }
}
