/* ==========================================================
   Prueba contra un proyecto real de Supabase: Row Level Security.
   npm run test:supabase   (lee .env.supabase.local)
   Crea dos usuarios de prueba, guarda datos con el primero y comprueba
   que el segundo (y un visitante sin sesión) no puede leerlos, cambiarlos
   ni borrarlos, ni escribir filas a nombre del otro.
   Requiere: supabase/schema.sql aplicado, "Confirm email" desactivado y
   SUPABASE_TEST_EMAIL (una dirección tuya que admita alias con +) en .env.supabase.local.
   ========================================================== */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SupabaseStore } from '../../src/services/storage/supabaseStore';

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../../.env.supabase.local'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;
// Dirección tuya con alias: "nombre@dominio" → "nombre+rls-a-123@dominio". Así ningún correo llega a desconocidos.
const BASE = env.SUPABASE_TEST_EMAIL || '';
if (!/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(BASE)) throw new Error('Añade SUPABASE_TEST_EMAIL=tu-correo@dominio (sin +) a .env.supabase.local');
const alias = (tag: string) => BASE.replace('@', `+rls-${tag}-${Date.now()}@`);
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const stamp = Date.now();
const PASSWORD = 'prueba-rls-' + stamp;

async function newUser(tag: string) {
  const c = client();
  const { data, error } = await c.auth.signUp({ email: alias(tag), password: PASSWORD });
  if (error) throw new Error(`signUp ${tag}: ${error.message}`);
  if (!data.session) throw new Error('Supabase no devolvió sesión: desactiva "Confirm email" en Authentication → Providers → Email.');
  return { c, id: data.user!.id, store: new SupabaseStore(c, data.user!.id) };
}

const TABLES = ['profiles', 'workouts', 'workout_sets', 'exercise_notes', 'body_weights'] as const;

describe('Row Level Security en Supabase', () => {
  let A: Awaited<ReturnType<typeof newUser>>, B: Awaited<ReturnType<typeof newUser>>;
  let anon: SupabaseClient;
  let workoutId = '', bodyWeightId = '';

  beforeAll(async () => {
    A = await newUser('a');
    B = await newUser('b');
    anon = client();
    // A guarda datos con el mismo adaptador que usa la app
    await A.store.saveProfile({ name: 'Usuaria A', age: 40, sex: 'Mujer', goal: '', level: '', routine_id: 'maleUpperLower', start_date: '2026-09-01', health_notice_ack_at: null, theme: 'auto', show_body_weight: true });
    const w = await A.store.createWorkout({ program_id: 'maleUpperLower', day_id: 'PA' });
    workoutId = w.id;
    await A.store.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 80, reps: 8, rir: 2 });
    await A.store.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 82.5, reps: 8, rir: 2 }); // upsert, no duplica
    await A.store.saveNote('squat_bar', 'Nota privada');
    bodyWeightId = (await A.store.addBodyWeight({ date: '2026-09-20', weight_kg: 74.6, note: 'En ayunas' })).id;
  }, 60_000);

  afterAll(async () => {
    // Limpieza de las filas de prueba (los usuarios de Auth quedan: bórralos en Authentication → Users)
    if (A) { await A.c.from('workouts').delete().eq('user_id', A.id); await A.c.from('exercise_notes').delete().eq('user_id', A.id); await A.c.from('body_weights').delete().eq('user_id', A.id); await A.c.from('profiles').delete().eq('user_id', A.id); }
    if (B) await B.c.from('profiles').delete().eq('user_id', B.id);
  });

  it('A lee sus propios datos con el adaptador de la app', async () => {
    const d = await A.store.loadAll();
    expect(d.profile?.name).toBe('Usuaria A');
    expect(d.workouts).toHaveLength(1);
    expect(d.sets).toHaveLength(1);
    expect(d.sets[0]).toMatchObject({ weight: 82.5, reps: 8, rir: 2 });
    expect(d.notes.squat_bar.note).toBe('Nota privada');
    expect(d.bodyWeights[0]).toMatchObject({ weight_kg: 74.6, note: 'En ayunas' });
  });

  it('B no ve ninguna fila de A en ninguna tabla (ni filtrando por su user_id)', async () => {
    for (const t of TABLES) {
      const all = await B.c.from(t).select('*');
      expect(all.error, t).toBeNull();
      expect(all.data, t).toEqual([]);
      const byId = await B.c.from(t).select('*').eq('user_id', A.id);
      expect(byId.data, t).toEqual([]);
    }
    const d = await B.store.loadAll();
    expect(d).toEqual({ profile: null, workouts: [], sets: [], notes: {}, bodyWeights: [] });
  });

  it('B no puede modificar ni borrar datos de A', async () => {
    const upd = await B.c.from('workouts').update({ notes: 'hackeado' }).eq('id', workoutId).select();
    expect(upd.data).toEqual([]);
    await B.c.from('body_weights').delete().eq('id', bodyWeightId);
    await B.c.from('workout_sets').delete().eq('workout_id', workoutId);
    await B.c.from('profiles').delete().eq('user_id', A.id);
    const d = await A.store.loadAll();
    expect(d.workouts[0].notes).toBe('');
    expect(d.bodyWeights).toHaveLength(1);
    expect(d.sets).toHaveLength(1);
    expect(d.profile).not.toBeNull();
  });

  it('B no puede escribir filas a nombre de A', async () => {
    const r = await B.c.from('body_weights').insert({ user_id: A.id, date: '2026-09-21', weight_kg: 50 });
    expect(r.error?.message).toMatch(/row-level security/i);
    const p = await B.c.from('profiles').upsert({ id: A.id, user_id: A.id, name: 'Suplantada', routine_id: 'maleUpperLower' });
    expect(p.error).not.toBeNull();
  });

  it('B no puede colgar series de un entrenamiento de A', async () => {
    const r = await B.c.from('workout_sets').insert({ user_id: B.id, workout_id: workoutId, exercise_key: 'squat_bar', set_index: 5, weight: 1, reps: 1 });
    expect(r.error).not.toBeNull();
  });

  it('un visitante sin sesión no puede leer nada', async () => {
    for (const t of TABLES) {
      const r = await anon.from(t).select('*');
      expect(r.data ?? [], t).toEqual([]);
    }
  });
});
