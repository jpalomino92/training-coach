import { describe, expect, it, vi } from 'vitest';
import { LocalStore } from '../../src/services/storage/localStore';
import { classify, OfflineStore, outboxKey } from '../../src/services/storage/offlineStore';
import { StoreError, type Store } from '../../src/services/storage/types';
import type { ProfileInput } from '../../src/domain/types';

/** "Servidor" en memoria (otro LocalStore) al que se le puede cortar la red o hacer fallar. */
function fakeRemote(userId: string) {
  const server = new LocalStore(userId, localStorage, 'servidor:' + userId);
  const state = { down: false, failNext: null as StoreError | null, calls: [] as string[] };
  const remote = new Proxy(server, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (typeof v !== 'function' || prop === 'constructor') return v;
      return async (...args: unknown[]) => {
        if (state.down) throw new StoreError('TypeError: Failed to fetch', '', 0);
        if (state.failNext) { const e = state.failNext; state.failNext = null; throw e; }
        state.calls.push(String(prop));
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    }
  }) as unknown as Store;
  return { remote, server, state };
}

const profile: ProfileInput = { name: 'Ana', age: 40, sex: 'Mujer', goal: '', level: '', routine_id: 'maleUpperLower', start_date: '2026-09-01', health_notice_ack_at: null, theme: 'auto', show_body_weight: true };

describe('cola sin conexión', () => {
  it('con conexión: guarda en el dispositivo y lo envía al servidor con el mismo id', async () => {
    const { remote, server } = fakeRemote('u1');
    const s = new OfflineStore(remote, 'u1');
    await s.saveProfile(profile);
    const w = await s.createWorkout({ program_id: 'maleUpperLower', day_id: 'PA' });
    const set = await s.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 80, reps: 8, rir: 2 });
    await s.flush();
    const d = await server.loadAll();
    expect(d.profile?.name).toBe('Ana');
    expect(d.workouts[0].id).toBe(w.id);
    expect(d.sets[0].id).toBe(set.id);
    expect(s.getSyncState().pending).toBe(0);
  });

  it('sin conexión: los cambios se ven al momento, se guardan en la cola y se envían en orden al volver', async () => {
    const { remote, server, state } = fakeRemote('u1');
    const s = new OfflineStore(remote, 'u1');
    await s.saveProfile(profile);
    await s.flush();
    state.down = true;

    const w = await s.createWorkout({ program_id: 'maleUpperLower', day_id: 'PA' });
    await s.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 0, weight: 80, reps: 8, rir: 2 });
    await s.upsertSet({ workout_id: w.id, exercise_key: 'squat_bar', set_index: 1, weight: 80, reps: 7, rir: 1 });
    await s.updateWorkout(w.id, { feel: { squat_bar: 'pain' } });
    await s.saveNote('squat_bar', 'Barra en la 5');
    await s.addBodyWeight({ date: '2026-09-20', weight_kg: 74.6 });
    await s.flush();

    // La app ve todo aunque no haya llegado al servidor
    const local = await s.loadAll();
    expect(local.sets).toHaveLength(2);
    expect(local.workouts[0].feel).toEqual({ squat_bar: 'pain' });
    expect(s.getSyncState()).toMatchObject({ pending: 6, online: false });
    expect((await server.loadAll()).workouts).toHaveLength(0);

    state.down = false;
    state.calls = [];
    await s.flush();
    expect(state.calls).toEqual(['createWorkout', 'upsertSet', 'upsertSet', 'updateWorkout', 'saveNote', 'addBodyWeight']);
    const d = await server.loadAll();
    expect(d.sets.map(x => x.reps)).toEqual([8, 7]);
    expect(d.workouts[0].feel).toEqual({ squat_bar: 'pain' });
    expect(d.notes.squat_bar.note).toBe('Barra en la 5');
    expect(d.bodyWeights[0].weight_kg).toBe(74.6);
    expect(s.getSyncState()).toMatchObject({ pending: 0, online: true });
  });

  it('la cola sobrevive a cerrar y abrir la app', async () => {
    const { remote, server, state } = fakeRemote('u1');
    state.down = true;
    const s1 = new OfflineStore(remote, 'u1');
    await s1.addBodyWeight({ date: '2026-09-20', weight_kg: 70 });
    s1.dispose();
    expect(JSON.parse(localStorage.getItem(outboxKey('u1'))!)).toHaveLength(1);

    // "Reabrir" sin conexión: arranca con la copia local
    const s2 = new OfflineStore(remote, 'u1');
    expect((await s2.loadAll()).bodyWeights).toHaveLength(1);
    state.down = false;
    const d = await s2.loadAll(); // envía la cola y luego trae el servidor
    expect(d.bodyWeights).toHaveLength(1);
    expect((await server.loadAll()).bodyWeights).toHaveLength(1);
  });

  it('con conexión, loadAll sustituye la copia local por los datos del servidor', async () => {
    const { remote, server } = fakeRemote('u1');
    await server.saveProfile({ ...profile, name: 'Desde otro dispositivo' });
    const s = new OfflineStore(remote, 'u1');
    expect((await s.loadAll()).profile?.name).toBe('Desde otro dispositivo');
  });

  it('un rechazo definitivo se descarta y se avisa, sin bloquear el resto de la cola', async () => {
    const { remote, server, state } = fakeRemote('u1');
    const s = new OfflineStore(remote, 'u1');
    const rejected = vi.fn();
    s.onRejected(rejected);
    state.down = true;
    await s.addBodyWeight({ date: '2026-09-20', weight_kg: 70 });
    await s.addBodyWeight({ date: '2026-09-21', weight_kg: 71 });
    await s.flush(); // termina el intento sin red
    state.down = false;
    state.failNext = new StoreError('new row violates check constraint', '23514', 400);
    await s.flush();
    expect(rejected).toHaveBeenCalledWith(1);
    expect((await server.loadAll()).bodyWeights.map(b => b.weight_kg)).toEqual([71]);
    expect(s.getSyncState().pending).toBe(0);
  });

  it('sesión caducada: se reintenta más tarde en lugar de perder el cambio', async () => {
    const { remote, state } = fakeRemote('u1');
    const s = new OfflineStore(remote, 'u1');
    state.down = true;
    await s.saveNote('squat_bar', 'hola');
    await s.flush(); // termina el intento sin red
    state.down = false;
    state.failNext = new StoreError('JWT expired', 'PGRST301', 401);
    await s.flush();
    expect(s.getSyncState().pending).toBe(1);
    await s.flush();
    expect(s.getSyncState().pending).toBe(0);
    s.dispose();
  });

  it('clasifica los errores', () => {
    expect(classify(new TypeError('Failed to fetch'))).toBe('retry');
    expect(classify(new StoreError('Failed to fetch', '', 0))).toBe('retry');
    expect(classify(new StoreError('boom', '', 503))).toBe('retry');
    expect(classify(new StoreError('JWT expired', 'PGRST301', 401))).toBe('retry');
    expect(classify(new StoreError('duplicate key value', '23505', 409))).toBe('done');
    expect(classify(new StoreError('new row violates row-level security policy', '42501', 403))).toBe('reject');
    expect(classify(new StoreError('violates check constraint', '23514', 400))).toBe('reject');
  });

  it('copia local y cola separadas por usuario', async () => {
    const a = new OfflineStore(fakeRemote('a').remote, 'a');
    const b = new OfflineStore(fakeRemote('b').remote, 'b');
    await a.saveNote('squat_bar', 'de A');
    expect((await b.loadAll()).notes).toEqual({});
    expect(outboxKey('a')).not.toBe(outboxKey('b'));
  });
});
