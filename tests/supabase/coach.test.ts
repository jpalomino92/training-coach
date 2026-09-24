/* ==========================================================
   Entrenador y alumnos contra el proyecto real de Supabase (RLS).
   npm run test:supabase
   Requiere supabase/migrations/2026-09-26_coach.sql aplicado y la cuenta
   de prueba "test-a" dada de alta como entrenadora (ver el final de la migración).
   ========================================================== */
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { duplicateProgram } from '../../src/domain/customProgram';
import { programList } from '../../src/domain/routines';
import { CoachService } from '../../src/services/coach';
import { SupabaseStore } from '../../src/services/storage/supabaseStore';
import { newClient, resetAccount, testEmail } from './accounts';

type Acc = Awaited<ReturnType<typeof resetAccount>> & { coach: CoachService; store: SupabaseStore };

async function account(tag: 'test-a' | 'test-b'): Promise<Acc> {
  const acc = await resetAccount(tag);
  const coach = new CoachService(acc.c, acc.id);
  await acc.c.rpc('leave_coach');
  await acc.c.from('coach_invites').delete().eq('coach_id', acc.id);
  await acc.c.from('custom_programs').delete().eq('coach_id', acc.id);
  return { ...acc, coach, store: new SupabaseStore(acc.c, acc.id) };
}

describe('Entrenador y alumnos (RLS)', () => {
  let A: Acc, B: Acc;
  let anon: SupabaseClient;
  let programId = '';

  beforeAll(async () => {
    A = await account('test-a');
    B = await account('test-b');
    anon = newClient();
    if (!(await A.coach.coachInfo())) {
      throw new Error(`Da de alta ${testEmail('test-a')} en public.coaches (SQL editor) para ejecutar estas pruebas.`);
    }
    await B.store.saveProfile({ name: 'Alumna B', age: 35, sex: 'Mujer', goal: '', level: '', routine_id: 'maleUpperLower', start_date: '2026-09-01', health_notice_ack_at: null, theme: 'auto', show_body_weight: true });
    const w = await B.store.createWorkout({ program_id: 'maleUpperLower', day_id: 'PA' });
    await B.store.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 60, reps: 8, rir: 2 });
    await B.store.saveNote('squat_bar', 'Nota privada de B');
  }, 60_000);

  afterAll(async () => {
    await B?.c.rpc('leave_coach');
    for (const acc of [A, B]) {
      if (!acc) continue;
      await acc.c.from('coach_invites').delete().eq('coach_id', acc.id);
      await acc.c.from('custom_programs').delete().eq('coach_id', acc.id);
    }
    await resetAccount('test-a');
    await resetAccount('test-b');
  });

  it('nadie se puede dar de alta como entrenador desde la app', async () => {
    const r = await B.c.from('coaches').insert({ user_id: B.id, display_name: 'Yo' });
    expect(r.error).not.toBeNull();
    expect(await B.coach.coachInfo()).toBeNull();
  });

  it('sin unirse, el entrenador no ve nada del alumno', async () => {
    const r = await A.c.from('workouts').select('id').eq('user_id', B.id);
    expect(r.data).toEqual([]);
  });

  it('un alumno no puede crear rutinas ni invitaciones', async () => {
    const p = await B.c.from('custom_programs').insert({ coach_id: B.id, data: {} });
    expect(p.error).not.toBeNull();
    const i = await B.c.from('coach_invites').insert({ code: 'ZZZZ2222', coach_id: B.id, coach_name: 'B' });
    expect(i.error).not.toBeNull();
  });

  it('flujo completo: rutina, invitación, unirse, asignar, ver progreso (sin notas) y dejar de compartir', async () => {
    const saved = await A.coach.saveProgram({ ...duplicateProgram(programList()[0], 'Coach A'), name: 'Prueba RLS' });
    programId = saved.id;
    expect(saved.id).toMatch(/^custom:/);

    // B no puede leer la rutina hasta que se la asignen
    expect((await B.c.from('custom_programs').select('id')).data).toEqual([]);
    expect((await anon.from('custom_programs').select('id')).data ?? []).toEqual([]);

    const inv = await A.coach.createInvite('Coach A');
    await expect(A.coach.joinWithCode(inv.code)).rejects.toThrow(); // su propio código no
    const link = await B.coach.joinWithCode(inv.code);
    expect(link.coachName).toBe('Coach A');
    await expect(B.coach.joinWithCode(inv.code)).rejects.toThrow(); // un solo uso

    const athletes = await A.coach.listAthletes();
    expect(athletes.map(a => a.name)).toEqual(['Alumna B']);

    await A.coach.assign(B.id, programId);
    const st = await B.coach.athleteState();
    expect(st.link?.coachName).toBe('Coach A');
    expect(st.program?.id).toBe(programId);
    expect(st.program?.name).toBe('Prueba RLS');

    const data = await A.coach.athleteData(B.id);
    expect(data.workouts).toHaveLength(1);
    expect(data.sets[0].weight).toBe(60);
    const notes = await A.c.from('exercise_notes').select('*').eq('user_id', B.id);
    expect(notes.data).toEqual([]);

    // El entrenador lee, pero no escribe en los datos del alumno
    const upd = await A.c.from('workouts').update({ notes: 'hackeado' }).eq('user_id', B.id).select('id');
    expect(upd.data ?? []).toEqual([]);
    // Y el alumno no puede cambiar la rutina del entrenador
    const upd2 = await B.c.from('custom_programs').update({ data: {} }).eq('id', programId.slice(7)).select('id');
    expect(upd2.data ?? []).toEqual([]);

    await B.coach.leaveCoach();
    expect((await A.c.from('workouts').select('id').eq('user_id', B.id)).data).toEqual([]);
    const after = await B.coach.athleteState();
    expect(after).toEqual({ link: null, program: null });
  });
});
