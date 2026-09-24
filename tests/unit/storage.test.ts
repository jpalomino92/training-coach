import { describe, expect, it } from 'vitest';
import { DemoAuth } from '../../src/services/auth/demoAuth';
import { LocalStore, dataKey } from '../../src/services/storage/localStore';
import type { ProfileInput } from '../../src/domain/types';

const profile = (name: string, routine_id = 'maleUpperLower'): ProfileInput => ({
  name, age: 40, sex: 'Mujer', goal: 'Ganar fuerza', level: 'Intermedio', routine_id,
  start_date: '2026-09-01', health_notice_ack_at: null, theme: 'auto', show_body_weight: true
});

async function seed(store: LocalStore) {
  await store.saveProfile(profile('Ana'));
  const w = await store.createWorkout({ program_id: 'maleUpperLower', day_id: 'PA' });
  await store.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 80, reps: 8, rir: 2 });
  await store.saveNote('squat_bar', 'Barra en posición 5');
  await store.addBodyWeight({ date: '2026-09-20', weight_kg: 74.6 });
  return w;
}

describe('almacenamiento local', () => {
  it('todos los registros llevan user_id', async () => {
    const s = new LocalStore('u1');
    await seed(s);
    const d = await s.loadAll();
    expect(d.profile!.user_id).toBe('u1');
    expect(d.profile!.id).toBe('u1');
    for (const r of [...d.workouts, ...d.sets, ...Object.values(d.notes), ...d.bodyWeights]) expect(r.user_id).toBe('u1');
  });

  it('upsertSet sustituye la misma serie en lugar de duplicarla', async () => {
    const s = new LocalStore('u1');
    const w = await seed(s);
    const again = await s.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 82.5, reps: 7, rir: 1 });
    const d = await s.loadAll();
    expect(d.sets).toHaveLength(1);
    expect(d.sets[0]).toMatchObject({ id: again.id, weight: 82.5, reps: 7, rir: 1 });
  });

  it('borrar un entrenamiento borra sus series', async () => {
    const s = new LocalStore('u1');
    const w = await seed(s);
    await s.deleteWorkout(w.id);
    const d = await s.loadAll();
    expect(d.workouts).toHaveLength(0);
    expect(d.sets).toHaveLength(0);
  });

  it('borrar una serie', async () => {
    const s = new LocalStore('u1');
    await seed(s);
    const [set] = (await s.loadAll()).sets;
    await s.deleteSet(set.id);
    expect((await s.loadAll()).sets).toHaveLength(0);
  });

  it('loadAll devuelve copias: modificar el resultado no cambia lo guardado', async () => {
    const s = new LocalStore('u1');
    await seed(s);
    const d = await s.loadAll();
    d.sets[0].weight = 999;
    expect((await s.loadAll()).sets[0].weight).toBe(80);
  });

  it('separación de datos: dos usuarios no ven ni tocan los datos del otro', async () => {
    const a = new LocalStore('user-a');
    const b = new LocalStore('user-b');
    const wa = await seed(a);
    await b.saveProfile(profile('Bea', 'femaleFatLossMuscle'));

    const db = await b.loadAll();
    expect(db.profile!.name).toBe('Bea');
    expect(db.workouts).toHaveLength(0);
    expect(db.sets).toHaveLength(0);
    expect(db.notes).toEqual({});
    expect(db.bodyWeights).toHaveLength(0);

    // B no puede modificar ni borrar registros de A
    await expect(b.updateWorkout(wa.id, { status: 'completed' })).rejects.toThrow();
    await expect(b.upsertSet({ workout_id: wa.id, exercise_key: 'x', set_index: 0, weight: 1, reps: 1, rir: 1 })).rejects.toThrow();
    const aw = (await a.loadAll()).bodyWeights[0];
    await expect(b.updateBodyWeight(aw.id, { weight_kg: 1 })).rejects.toThrow();
    await b.deleteWorkout(wa.id);
    await b.deleteBodyWeight(aw.id);

    const da = await new LocalStore('user-a').loadAll();
    expect(da.profile!.name).toBe('Ana');
    expect(da.workouts).toHaveLength(1);
    expect(da.sets).toHaveLength(1);
    expect(da.bodyWeights).toHaveLength(1);
    expect(dataKey('user-a')).not.toBe(dataKey('user-b'));
  });

  it('ignora registros ajenos aunque aparezcan en su clave', async () => {
    const a = new LocalStore('user-a');
    await seed(a);
    const raw = JSON.parse(localStorage.getItem(dataKey('user-a'))!);
    raw.sets.push({ ...raw.sets[0], id: 'intruso', user_id: 'user-b' });
    localStorage.setItem(dataKey('user-a'), JSON.stringify(raw));
    const d = await new LocalStore('user-a').loadAll();
    expect(d.sets.map(s => s.id)).not.toContain('intruso');
  });

  it('los datos persisten tras cerrar sesión y volver a entrar', async () => {
    const auth = new DemoAuth(localStorage, 1000);
    const u = await auth.signUp('ana@correo.com', 'contraseña-larga');
    await seed(new LocalStore(u.id));
    await auth.signOut();
    const again = await auth.signIn('ana@correo.com', 'contraseña-larga');
    const d = await new LocalStore(again.id).loadAll();
    expect(d.profile!.name).toBe('Ana');
    expect(d.sets).toHaveLength(1);
    expect(d.notes.squat_bar.note).toBe('Barra en posición 5');
    expect(d.bodyWeights[0].weight_kg).toBe(74.6);
  });

  it('peso corporal: registrar, editar (con nota) y borrar', async () => {
    const s = new LocalStore('u1');
    const b1 = await s.addBodyWeight({ date: '2026-09-15', weight_kg: 74.6 });
    await s.addBodyWeight({ date: '2026-09-22', weight_kg: 74.1, note: 'Después de desayunar' });
    expect(b1).toMatchObject({ user_id: 'u1', date: '2026-09-15', weight_kg: 74.6, note: '' });
    expect(b1.created_at).toBeTruthy();

    await s.updateBodyWeight(b1.id, { weight_kg: 74.8, note: 'En ayunas' });
    let d = await s.loadAll();
    expect(d.bodyWeights).toHaveLength(2);
    expect(d.bodyWeights.find(b => b.id === b1.id)).toMatchObject({ weight_kg: 74.8, note: 'En ayunas', user_id: 'u1' });

    await s.deleteBodyWeight(b1.id);
    d = await s.loadAll();
    expect(d.bodyWeights.map(b => b.weight_kg)).toEqual([74.1]);
  });

  it('perfil: guarda preferencias y conserva created_at', async () => {
    const s = new LocalStore('u1');
    const p1 = await s.saveProfile(profile('Ana'));
    const p2 = await s.saveProfile({ ...profile('Ana'), theme: 'dark', show_body_weight: false });
    expect(p2.created_at).toBe(p1.created_at);
    expect(p2).toMatchObject({ theme: 'dark', show_body_weight: false });
  });
});
