/* ==========================================================
   Fantasma: tu "yo" de hace un mes en el mismo ejercicio.
   Se compara cada serie de hoy con la misma serie de entonces
   y, al terminar, en cuántos ejercicios le ganaste.
   ========================================================== */
import { isCardioMachineKey } from './cardio';
import { DAY_MS, isTimed, setText } from './format';
import type { Exercise, UserData, Workout, WorkoutSet } from './types';

/** Antigüedad mínima del fantasma (≈ 4 semanas de la misma rutina). */
export const GHOST_MIN_DAYS = 25;
/** Si aún no hay un mes de historial, el fantasma es la sesión más antigua de una semana anterior. */
const FALLBACK_MIN_DAYS = 6;

export interface Ghost { workout: Workout; sets: WorkoutSet[] }
export type GhostResult = 'win' | 'tie' | 'lose';

const when = (w: Workout) => +new Date(w.completed_at || w.started_at);

/** Entrenamientos que no cuentan (semanas de descarga). */
export type SkipWorkout = (w: Workout) => boolean;

/** La sesión del ejercicio de hace ~un mes (en cualquier rutina), o null si no hay ninguna anterior a esta semana. */
export function ghostFor(data: UserData, key: string, excludeWorkoutId?: string | null, now = Date.now(), skip?: SkipWorkout): Ghost | null {
  const sessions = data.workouts
    .filter(w => w.id !== excludeWorkoutId && w.status === 'completed' && !skip?.(w))
    .map(w => ({ workout: w, sets: data.sets.filter(s => s.workout_id === w.id && s.exercise_key === key).sort((a, b) => a.set_index - b.set_index) }))
    .filter(x => x.sets.length);
  const old = sessions.filter(x => when(x.workout) <= now - GHOST_MIN_DAYS * DAY_MS).sort((a, b) => when(b.workout) - when(a.workout))[0];
  if (old) return old;
  return sessions.filter(x => when(x.workout) <= now - FALLBACK_MIN_DAYS * DAY_MS).sort((a, b) => when(a.workout) - when(b.workout))[0] || null;
}

type SetLike = Pick<WorkoutSet, 'weight' | 'reps'>;

/** Puntuación de una serie: con carga, el 1RM estimado (Epley); sin carga o por tiempo, las repeticiones o el tiempo. */
export const setScore = (ex: Pick<Exercise, 'unit'>, s: SetLike) => (isTimed(ex) || !s.weight ? s.reps : s.weight * (1 + s.reps / 30));

export function compareSet(ex: Pick<Exercise, 'unit'>, mine: SetLike, ghost: SetLike): GhostResult {
  const a = setScore(ex, mine), b = setScore(ex, ghost);
  if (Math.abs(a - b) < 0.005 * Math.max(a, b)) return 'tie';
  return a > b ? 'win' : 'lose';
}

/** "Le ganas al fantasma por 2 repeticiones" / "El fantasma hizo 60 kg × 8". */
export function setVersus(ex: Pick<Exercise, 'unit' | 'load'>, mine: SetLike, ghost: SetLike): { result: GhostResult; text: string } {
  const result = compareSet(ex, mine, ghost);
  const sameLoad = (mine.weight || 0) === (ghost.weight || 0);
  const diff = mine.reps - ghost.reps;
  const ref = setText(ex, { ...ghost, rir: null });
  if (result === 'tie') return { result, text: `Empate con el fantasma (${ref})` };
  if (sameLoad && diff !== 0) {
    const unit = isTimed(ex) ? (ex.unit === 'min' ? 'min' : 's') : Math.abs(diff) === 1 ? 'repetición' : 'repeticiones';
    return { result, text: result === 'win' ? `Le ganas al fantasma por ${diff} ${unit}` : `El fantasma iba ${-diff} ${unit} por delante (${ref})` };
  }
  return { result, text: result === 'win' ? `Le ganas al fantasma (${ref})` : `El fantasma iba mejor (${ref})` };
}

/** Lo que hay que superar en esa serie: "Fantasma: 60 kg × 8". */
export function ghostTarget(ex: Pick<Exercise, 'unit' | 'load'>, ghost: Ghost | null, index: number): string | undefined {
  const s = ghost?.sets.find(x => x.set_index === index);
  return s ? `Fantasma: ${setText(ex, { ...s, rir: null })}` : undefined;
}

/** Resultado de todo el ejercicio: la mejor serie de hoy contra la mejor del fantasma. */
export function exerciseVersus(ex: Pick<Exercise, 'unit'>, today: SetLike[], ghost: SetLike[]): GhostResult | null {
  if (!today.length || !ghost.length) return null;
  const best = (list: SetLike[]) => list.reduce((m, s) => (setScore(ex, s) > setScore(ex, m) ? s : m));
  return compareSet(ex, best(today), best(ghost));
}

/** Resumen del entrenamiento contra el fantasma (solo ejercicios que tienen fantasma; sin cardio). */
export function workoutVersus(data: UserData, w: Workout, resolve: (key: string) => Exercise | null, skip?: SkipWorkout): { wins: number; ties: number; total: number } {
  const now = +new Date(w.started_at);
  const keys = [...new Set(data.sets.filter(s => s.workout_id === w.id && !isCardioMachineKey(s.exercise_key)).map(s => s.exercise_key))];
  let wins = 0, ties = 0, total = 0;
  for (const key of keys) {
    const ex = resolve(key);
    const ghost = ex && ghostFor(data, key, w.id, now, skip);
    if (!ex || !ghost) continue;
    const r = exerciseVersus(ex, data.sets.filter(s => s.workout_id === w.id && s.exercise_key === key), ghost.sets);
    if (!r) continue;
    total++;
    if (r === 'win') wins++; else if (r === 'tie') ties++;
  }
  return { wins, ties, total };
}

/* ---------- El fantasma como mascota: humor, nivel y racha ---------- */

/** smug: va ganando él · rival: parejos · scared: vas ganando tú · beaten: le ganaste en todo · sad: hace días que no entrenas. */
export type GhostMood = 'smug' | 'rival' | 'scared' | 'beaten' | 'sad';

/** Días sin entrenar a partir de los que el fantasma se pone triste. */
export const GHOST_SAD_DAYS = 10;
/** Nivel máximo (el tamaño del dibujo deja de crecer). */
export const GHOST_MAX_LEVEL = 10;

/** Humor según cuántas comparaciones van ganadas, empatadas y perdidas. */
export function moodFor(wins: number, losses: number, total = wins + losses): GhostMood {
  if (total > 0 && wins === total) return 'beaten';
  if (wins > losses) return 'scared';
  if (losses > wins) return 'smug';
  return 'rival';
}

export const MOOD_TEXT: Record<GhostMood, string> = {
  smug: 'Hoy te estoy ganando.',
  rival: '¿Me vas a superar?',
  scared: '¡No puede ser! Estás más fuerte.',
  beaten: '¡Me ganaste! Volveré más fuerte.',
  sad: 'Te extraño… ¿entrenamos?'
};

/** Comparaciones serie a serie de hoy contra el fantasma. */
export function setsVersus(ex: Pick<Exercise, 'unit'>, today: (SetLike & Pick<WorkoutSet, 'set_index'>)[], ghost: Ghost | null): { wins: number; losses: number; ties: number } {
  const out = { wins: 0, losses: 0, ties: 0 };
  if (!ghost) return out;
  for (const s of today) {
    const g = ghost.sets.find(x => x.set_index === s.set_index);
    if (!g) continue;
    const r = compareSet(ex, s, g);
    if (r === 'win') out.wins++; else if (r === 'lose') out.losses++; else out.ties++;
  }
  return out;
}

export interface GhostStats {
  /** 1 + semanas en las que le ganaste: tu yo de hace un mes cada vez es más fuerte. */
  level: number;
  /** Semanas seguidas (las más recientes) ganándole. */
  streak: number;
  weeksWon: number;
  /** La semana más reciente con comparación. */
  lastWeek: { wins: number; total: number } | null;
  /** Días desde el último entrenamiento completado (null si no hay ninguno). */
  idleDays: number | null;
  mood: GhostMood;
}

/**
 * Estadísticas del fantasma a partir del historial (no se guarda nada aparte).
 * Una semana se gana si en sus entrenamientos ganaste más ejercicios de los que perdiste.
 */
export function ghostStats(data: UserData, resolveFor: (w: Workout) => (key: string) => Exercise | null, now = Date.now(), skip?: SkipWorkout): GhostStats {
  const done = data.workouts.filter(w => w.status === 'completed').sort((a, b) => when(a) - when(b));
  const weeks = new Map<number, { wins: number; losses: number; total: number }>();
  for (const w of done) {
    if (skip?.(w)) continue;
    const v = workoutVersus(data, w, resolveFor(w), skip);
    if (!v.total) continue;
    const start = new Date(when(w)); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const k = +start;
    const acc = weeks.get(k) || { wins: 0, losses: 0, total: 0 };
    acc.wins += v.wins; acc.losses += v.total - v.wins - v.ties; acc.total += v.total;
    weeks.set(k, acc);
  }
  const list = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  const won = (v: { wins: number; losses: number }) => v.wins > v.losses;
  const weeksWon = list.filter(won).length;
  let streak = 0;
  for (let i = list.length - 1; i >= 0 && won(list[i]); i--) streak++;
  const last = list[list.length - 1] || null;
  const idleDays = done.length ? Math.floor((now - when(done[done.length - 1])) / DAY_MS) : null;
  const mood: GhostMood = idleDays != null && idleDays >= GHOST_SAD_DAYS ? 'sad'
    : last ? moodFor(last.wins, last.losses, last.total) : 'rival';
  return { level: Math.min(GHOST_MAX_LEVEL, 1 + weeksWon), streak, weeksWon, lastWeek: last && { wins: last.wins, total: last.total }, idleDays, mood };
}

/** Humor dentro de un ejercicio: solo se da por derrotado cuando terminas el ejercicio sin perder ninguna serie. */
export function exerciseMood(v: { wins: number; losses: number }, complete: boolean): GhostMood {
  if (complete && v.wins > 0 && v.losses === 0) return 'beaten';
  if (v.wins > v.losses) return 'scared';
  if (v.losses > v.wins) return 'smug';
  return 'rival';
}
