/* ==========================================================
   Estancamiento y descarga.
   - Un ejercicio está estancado si lleva ≥ 3 semanas y ≥ 3 sesiones
     sin superar su mejor marca, o si perdió contra el fantasma en
     las últimas 3 sesiones.
   - Plan para salir: bajar un 10 % y volver a subir, o pasar a la
     alternativa unas semanas. El plan dura 4 semanas.
   - Semana de descarga: tras 7 semanas seguidas entrenando. Esas
     semanas no cuentan para el fantasma ni para el estancamiento.
   ========================================================== */
import { weekStart } from './consistency';
import { DAY_MS, localDate, round2 } from './format';
import { exerciseVersus, ghostFor, setScore } from './ghost';
import type { Exercise, Prefs, StallPlan, UserData, Workout, WorkoutSet } from './types';

export const STALL_MIN_WEEKS = 3;
export const STALL_MIN_SESSIONS = 3;
/** Pérdidas seguidas contra el fantasma que cuentan como estancamiento. */
export const STALL_GHOST_LOSSES = 3;
/** Duración de un plan (o de "ahora no"). */
export const PLAN_DAYS = 28;
export const DELOAD_EVERY_WEEKS = 7;

const when = (w: Workout) => +new Date(w.completed_at || w.started_at);
const weekKey = (t: number | string | Date) => localDate(weekStart(t));

/** Entrenamiento hecho en una semana marcada como descarga. */
export const isDeloadWorkout = (prefs: Pick<Prefs, 'deload_weeks'>) => (w: Workout) =>
  !!prefs.deload_weeks?.includes(weekKey(when(w)));

export const isDeloadWeek = (prefs: Pick<Prefs, 'deload_weeks'>, now = Date.now()) => !!prefs.deload_weeks?.includes(weekKey(now));

/** Plan de un ejercicio que sigue vigente (4 semanas desde que se eligió). */
export function activePlan(prefs: Pick<Prefs, 'stall_plans'>, key: string, now = Date.now()): StallPlan | null {
  const p = prefs.stall_plans?.[key];
  return p && now - +new Date(p.at) < PLAN_DAYS * DAY_MS ? p : null;
}

export interface Stall {
  /** Semanas desde la última mejor marca. */
  weeks: number;
  /** Sesiones desde la última mejor marca. */
  sessions: number;
  /** Mejor serie (la que hay que superar). */
  best: Pick<WorkoutSet, 'weight' | 'reps'>;
  /** Sesiones seguidas perdiendo contra el fantasma. */
  ghostLosses: number;
  /** Peso para el reinicio (−10 %), si el ejercicio lleva carga. */
  resetWeight: number | null;
}

interface Session { w: Workout; sets: WorkoutSet[]; score: number; best: WorkoutSet }

/** ¿Está estancado el ejercicio? null si progresa, si hay pocos datos o si ya hay un plan en marcha. */
export function stallFor(data: UserData, ex: Exercise, prefs: Pick<Prefs, 'deload_weeks' | 'stall_plans'>, now = Date.now()): Stall | null {
  if (ex.unit === 'min' || ex.cardioSlot || activePlan(prefs, ex.key, now)) return null;
  const skip = isDeloadWorkout(prefs);
  const sessions: Session[] = data.workouts
    .filter(w => w.status === 'completed' && !skip(w))
    .sort((a, b) => when(a) - when(b))
    .map(w => {
      const sets = data.sets.filter(s => s.workout_id === w.id && s.exercise_key === ex.key);
      const best = sets.reduce<WorkoutSet | null>((m, s) => (!m || setScore(ex, s) > setScore(ex, m) ? s : m), null);
      return best ? { w, sets, score: setScore(ex, best), best } : null;
    })
    .filter((x): x is Session => !!x);
  // Las sesiones anteriores a un plan ya terminado no cuentan: el plan reinicia la cuenta
  const planAt = prefs.stall_plans?.[ex.key]?.at;
  const list = planAt ? sessions.filter(s => when(s.w) >= +new Date(planAt)) : sessions;
  if (list.length < STALL_MIN_SESSIONS + 1) return null;

  // Última vez que superó (en más de un 1 %) lo mejor que había hecho antes
  let lastImprovement = 0, top = list[0].score;
  list.forEach((s, i) => { if (i > 0 && s.score > top * 1.01) lastImprovement = i; top = Math.max(top, s.score); });
  const since = list.length - 1 - lastImprovement;
  const weeks = Math.floor((now - when(list[lastImprovement].w)) / (7 * DAY_MS));
  const bestSession = list.reduce((m, s) => (s.score > m.score ? s : m));

  let ghostLosses = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const g = ghostFor(data, ex.key, list[i].w.id, when(list[i].w), skip);
    if (!g || exerciseVersus(ex, list[i].sets, g.sets) !== 'lose') break;
    ghostLosses++;
  }

  const stalled = (since >= STALL_MIN_SESSIONS && weeks >= STALL_MIN_WEEKS) || ghostLosses >= STALL_GHOST_LOSSES;
  if (!stalled) return null;
  const w = bestSession.best.weight || 0;
  const step = ex.weightStep || 1;
  return {
    weeks, sessions: since, ghostLosses,
    best: { weight: bestSession.best.weight, reps: bestSession.best.reps },
    resetWeight: w > 0 ? Math.max(step, round2(Math.round((w * 0.9) / step) * step)) : null
  };
}

/** Semanas seguidas con algún entrenamiento completado, hasta la anterior a esta, desde la última descarga. */
export function weeksSinceDeload(data: UserData, prefs: Pick<Prefs, 'deload_weeks'>, now = Date.now()): number {
  const trained = new Set(data.workouts.filter(w => w.status === 'completed').map(w => weekKey(when(w))));
  const deloads = new Set(prefs.deload_weeks || []);
  let n = 0;
  const d = weekStart(now);
  for (;;) {
    d.setDate(d.getDate() - 7);
    const k = localDate(d);
    if (deloads.has(k) || !trained.has(k)) break;
    n++;
  }
  return n;
}

/** Proponer descarga esta semana: ≥ 7 semanas seguidas entrenando y sin haberla descartado esta semana. */
export function shouldSuggestDeload(data: UserData, prefs: Pick<Prefs, 'deload_weeks' | 'deload_dismissed'>, now = Date.now()): number | null {
  if (isDeloadWeek(prefs, now) || prefs.deload_dismissed === weekKey(now)) return null;
  const n = weeksSinceDeload(data, prefs, now);
  return n >= DELOAD_EVERY_WEEKS ? n : null;
}

export const thisWeekKey = (now = Date.now()) => weekKey(now);

/** Peso propuesto en descarga: un 10 % menos, redondeado al paso del ejercicio. */
export const deloadWeight = (ex: Pick<Exercise, 'weightStep'>, w: number) => {
  const step = ex.weightStep || 1;
  return Math.max(0, round2(Math.round((w * 0.9) / step) * step));
};
