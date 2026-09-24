/* ==========================================================
   Estado de la app: sesión, datos del usuario, navegación y avisos.
   Contexto + useReducer: no hay estado global suelto.
   Todas las escrituras pasan por el Store (que añade user_id) y
   después se reflejan en memoria con el reducer.
   ========================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { getProgram } from '../domain/routines';
import type { ImportedWorkout } from '../domain/csv';
import { prefsOf } from '../domain/prefs';
import type {
  AuthUser, BodyWeightInput, Exercise, Feel, Prefs, Profile, ProfileInput, Program, UserData, Workout, WorkoutDay, WorkoutSet
} from '../domain/types';
import { activeWorkout, defaultDayId, isDayDone, setsOf } from '../domain/workout';
import { createBackend, type Backend } from '../services/backend';
import { emptyData, isSyncSource, type Store, type SyncState } from '../services/storage/types';
import { dataReducer } from './dataReducer';

export type Tab = 'hoy' | 'rutina' | 'progreso' | 'historial' | 'perfil';
export type Status = 'loading' | 'error' | 'signedOut' | 'ready';

export interface SetValues { weight: number | null; reps: number; rir: number | null }

export interface AppApi {
  status: Status;
  bootError: string;
  mode: 'demo' | 'supabase';
  user: AuthUser | null;
  data: UserData;
  profile: Profile | null;
  program: Program;
  tab: Tab;
  setTab(t: Tab): void;
  dayId: string;
  setDayId(id: string): void;
  editingProfile: boolean;
  setEditingProfile(v: boolean): void;
  toast: string;
  showToast(msg: string): void;
  /** Estado de la cola sin conexión (null en modo demo, que siempre es local). */
  sync: SyncState | null;
  /** Ajustes con sus valores por defecto. */
  prefs: Prefs;

  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  saveProfile(p: ProfileInput): Promise<void>;
  updatePrefs(p: Partial<Pick<Profile, 'theme' | 'show_body_weight'>>): Promise<void>;
  updateSettings(p: Partial<Prefs>): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  /** Importa registros de un CSV. Devuelve cuántos se guardaron. */
  importBodyWeights(rows: BodyWeightInput[]): Promise<number>;
  importWorkouts(workouts: ImportedWorkout[]): Promise<number>;

  /** Registra (o corrige) una serie. Devuelve si con ella se completó el día. */
  recordSet(day: WorkoutDay, ex: Exercise, index: number, v: SetValues): Promise<{ set: WorkoutSet; dayCompleted: boolean }>;
  removeSet(set: WorkoutSet): Promise<void>;
  setFeel(day: WorkoutDay, exKey: string, feel: Feel | null): Promise<void>;
  saveNote(exKey: string, text: string): Promise<void>;
  finishWorkout(day: WorkoutDay): Promise<void>;
  deleteWorkout(id: string): Promise<void>;
  addBodyWeight(b: BodyWeightInput): Promise<void>;
  updateBodyWeight(id: string, b: Partial<BodyWeightInput>): Promise<void>;
  deleteBodyWeight(id: string): Promise<void>;
}

const Ctx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuera de AppProvider');
  return v;
}

export function AppProvider({ children, backend: injected }: { children: ReactNode; backend?: Backend }) {
  const [backend, setBackend] = useState<Backend | null>(injected || null);
  const [status, setStatus] = useState<Status>('loading');
  const [bootError, setBootError] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, dispatch] = useReducer(dataReducer, undefined, emptyData);
  const storeRef = useRef<Store | null>(null);
  const [tab, setTabState] = useState<Tab>('hoy');
  const [dayIdState, setDayId] = useState<string>('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [toast, setToast] = useState('');
  const [sync, setSync] = useState<SyncState | null>(null);
  const unsubSync = useRef<(() => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const store = () => {
    if (!storeRef.current) throw new Error('No hay sesión iniciada.');
    return storeRef.current;
  };

  const releaseStore = useCallback(() => {
    unsubSync.current?.();
    unsubSync.current = null;
    (storeRef.current as { dispose?: () => void } | null)?.dispose?.();
    storeRef.current = null;
    setSync(null);
  }, []);

  const loadUser = useCallback(async (b: Backend, u: AuthUser) => {
    const s = b.createStore(u);
    const d = await s.loadAll();
    if (isSyncSource(s)) {
      const off1 = s.onSync(setSync);
      const off2 = s.onRejected(n => showToast(n === 1
        ? 'Un cambio no se pudo guardar en el servidor y se ha descartado.'
        : `${n} cambios no se pudieron guardar en el servidor y se han descartado.`));
      unsubSync.current = () => { off1(); off2(); };
      setSync(s.getSyncState());
    }
    storeRef.current = s;
    setUser(u);
    dispatch({ type: 'load', data: d });
    setTabState('hoy');
    setDayId('');
    setEditingProfile(false);
    setStatus('ready');
  }, [showToast]);

  // Arranque: crea el backend y recupera la sesión
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = injected || await createBackend();
        if (!alive) return;
        setBackend(b);
        const session = await b.auth.getSession();
        if (!alive) return;
        if (session) await loadUser(b, session); else setStatus('signedOut');
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setBootError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
    return () => { alive = false; };
  }, [injected, loadUser]);

  const profile = data.profile;
  const program = getProgram(profile?.routine_id);
  const dayId = program.days.some(d => d.id === dayIdState) ? dayIdState : defaultDayId(data, program);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.scrollTo({ top: 0 });
  }, []);

  const ensureWorkout = async (day: WorkoutDay): Promise<Workout> => {
    const w = activeWorkout(data, program, day.id);
    if (w) return w;
    const created = await store().createWorkout({ program_id: program.id, day_id: day.id, status: 'in_progress', started_at: new Date().toISOString(), feel: {} });
    dispatch({ type: 'workout', workout: created });
    return created;
  };

  const api: AppApi = {
    status, bootError, mode: backend?.auth.mode || 'demo', user, data, profile, program,
    tab, setTab, dayId, setDayId, editingProfile, setEditingProfile, toast, showToast, sync,
    prefs: prefsOf(profile),

    async signIn(email, password) {
      const u = await backend!.auth.signIn(email, password);
      await loadUser(backend!, u);
    },
    async signUp(email, password) {
      const u = await backend!.auth.signUp(email, password);
      await loadUser(backend!, u);
    },
    async signOut() {
      const pending = sync?.pending || 0;
      await backend!.auth.signOut();
      releaseStore();
      if (pending) showToast(`Quedan ${pending} ${pending === 1 ? 'cambio' : 'cambios'} por enviar: se enviarán cuando vuelvas a entrar con conexión.`);
      setUser(null);
      dispatch({ type: 'clear' });
      setEditingProfile(false);
      setTabState('hoy');
      setDayId('');
      setStatus('signedOut');
    },
    async updateSettings(patch) {
      if (!data.profile) return;
      const { id: _id, user_id: _u, updated_at: _up, ...rest } = data.profile;
      const saved = await store().saveProfile({ ...rest, prefs: { ...data.profile.prefs, ...patch } });
      dispatch({ type: 'profile', profile: saved });
    },
    async changePassword(current, next) {
      await backend!.auth.updatePassword(next, current);
    },
    async importBodyWeights(rows) {
      let n = 0;
      for (const r of rows) { dispatch({ type: 'bodyWeight', bodyWeight: await store().addBodyWeight(r) }); n++; }
      return n;
    },
    async importWorkouts(list) {
      let n = 0;
      for (const iw of list) {
        const at = new Date(`${iw.date}T12:00:00`).toISOString();
        const w = await store().createWorkout({ program_id: program.id, day_id: iw.dayId, status: 'completed', started_at: at, feel: {} });
        dispatch({ type: 'workout', workout: await store().updateWorkout(w.id, { status: 'completed', completed_at: at }) });
        for (const s of iw.sets) {
          dispatch({ type: 'set', set: await store().upsertSet({ workout_id: w.id, exercise_key: s.exercise.key, set_index: s.set_index, weight: s.weight, reps: s.reps, rir: s.rir }) });
          n++;
        }
      }
      return n;
    },
    async saveProfile(p) {
      const prev = data.profile;
      const saved = await store().saveProfile(p);
      if (prev && prev.routine_id !== saved.routine_id) setDayId('');
      dispatch({ type: 'profile', profile: saved });
      setEditingProfile(false);
    },
    async updatePrefs(patch) {
      if (!data.profile) return;
      const { id: _id, user_id: _u, updated_at: _up, ...rest } = data.profile;
      const saved = await store().saveProfile({ ...rest, ...patch });
      dispatch({ type: 'profile', profile: saved });
    },

    async recordSet(day, ex, index, v) {
      const w = await ensureWorkout(day);
      const set = await store().upsertSet({ workout_id: w.id, exercise_key: ex.key, set_index: index, weight: v.weight, reps: v.reps, rir: v.rir });
      dispatch({ type: 'set', set });
      const all = [...setsOf(data, w.id).filter(s => s.id !== set.id && !(s.exercise_key === ex.key && s.set_index === index)), set];
      const dayCompleted = w.status === 'in_progress' && isDayDone(all, day);
      if (dayCompleted) {
        dispatch({ type: 'workout', workout: await store().updateWorkout(w.id, { status: 'completed', completed_at: new Date().toISOString() }) });
      }
      return { set, dayCompleted };
    },
    async removeSet(set) {
      await store().deleteSet(set.id);
      dispatch({ type: 'setRemoved', id: set.id });
      const w = data.workouts.find(x => x.id === set.workout_id);
      // Si el día estaba completo, vuelve a quedar en progreso
      if (w && w.status === 'completed') {
        dispatch({ type: 'workout', workout: await store().updateWorkout(w.id, { status: 'in_progress', completed_at: null }) });
      }
    },
    async setFeel(day, exKey, feel) {
      const w = await ensureWorkout(day);
      const next = { ...(w.feel || {}) };
      if (feel) next[exKey] = feel; else delete next[exKey];
      dispatch({ type: 'workout', workout: await store().updateWorkout(w.id, { feel: next }) });
    },
    async saveNote(exKey, text) {
      dispatch({ type: 'note', note: await store().saveNote(exKey, text) });
    },
    async finishWorkout(day) {
      const w = activeWorkout(data, program, day.id);
      if (!w || w.status === 'completed') return;
      dispatch({ type: 'workout', workout: await store().updateWorkout(w.id, { status: 'completed', completed_at: new Date().toISOString() }) });
    },
    async deleteWorkout(id) {
      await store().deleteWorkout(id);
      dispatch({ type: 'workoutRemoved', id });
    },
    async addBodyWeight(b) {
      dispatch({ type: 'bodyWeight', bodyWeight: await store().addBodyWeight(b) });
    },
    async updateBodyWeight(id, b) {
      dispatch({ type: 'bodyWeight', bodyWeight: await store().updateBodyWeight(id, b) });
    },
    async deleteBodyWeight(id) {
      await store().deleteBodyWeight(id);
      dispatch({ type: 'bodyWeightRemoved', id });
    }
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Selector de conveniencia para el día elegido y su entrenamiento de hoy. */
export function useDay() {
  const { data, program, dayId } = useApp();
  return useMemo(() => {
    const day = program.days.find(d => d.id === dayId) || program.days[0];
    const workout = activeWorkout(data, program, day.id);
    const sets = workout ? setsOf(data, workout.id) : [];
    return { day, workout, sets };
  }, [data, program, dayId]);
}
