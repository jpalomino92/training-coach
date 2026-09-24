/* Selectores puros sobre los datos del usuario. No dependen de React. */
import { altExercise, altKey } from './alternatives';
import { DAY_MS, sameDay, toDate } from './format';
import { findExercise } from './routines';
import { summarize } from './progression';
import type { Exercise, Program, UserData, Workout, WorkoutDay, WorkoutSet } from './types';

export const byStartDesc = (a: Workout, b: Workout) => +new Date(b.started_at) - +new Date(a.started_at);
export const setsOf = (data: UserData, workoutId: string) => data.sets.filter(s => s.workout_id === workoutId);
export const programWorkouts = (data: UserData, program: Program) => data.workouts.filter(w => w.program_id === program.id);
export const totalSets = (day: WorkoutDay) => day.exercises.reduce((n, e) => n + e.sets, 0);

/** Entrenamiento de hoy para ese día: el que está en curso o el completado hoy. */
export function activeWorkout(data: UserData, program: Program, dayId: string, now = Date.now()): Workout | null {
  const list = programWorkouts(data, program).filter(w => w.day_id === dayId).sort(byStartDesc);
  return list.find(w => w.status === 'in_progress')
    || list.find(w => w.status === 'completed' && !!w.completed_at && sameDay(w.completed_at, now))
    || null;
}

export interface LastSession { workout: Workout; sets: WorkoutSet[] }

/** Última sesión (de este programa) en la que se registró el ejercicio. */
export function lastSessionFor(data: UserData, program: Program, key: string, excludeWorkoutId?: string | null): LastSession | null {
  const list = programWorkouts(data, program).filter(w => w.id !== excludeWorkoutId).sort(byStartDesc);
  for (const w of list) {
    const sets = setsOf(data, w.id).filter(s => s.exercise_key === key).sort((a, b) => a.set_index - b.set_index);
    if (sets.length) return { workout: w, sets };
  }
  return null;
}

/** En curso → completado hoy → el siguiente al último completado → el primero. */
export function defaultDayId(data: UserData, program: Program, now = Date.now()): string {
  const ws = programWorkouts(data, program).filter(w => program.days.some(d => d.id === w.day_id));
  const inProg = ws.filter(w => w.status === 'in_progress').sort(byStartDesc)[0];
  if (inProg) return inProg.day_id;
  const done = ws.filter(w => w.status === 'completed' && w.completed_at)
    .sort((a, b) => +new Date(b.completed_at!) - +new Date(a.completed_at!))[0];
  if (!done) return program.days[0].id;
  if (sameDay(done.completed_at!, now)) return done.day_id;
  const i = program.days.findIndex(d => d.id === done.day_id);
  return program.days[(i + 1) % program.days.length].id;
}

export type DayStatus = 'none' | 'prog' | 'done';
export const dayStatus = (w: Workout | null): DayStatus => (!w ? 'none' : w.status === 'completed' ? 'done' : 'prog');

/** Un ejercicio está hecho si todas sus series están registradas (con el ejercicio o con su alternativa). */
export function isExerciseDone(sets: WorkoutSet[], ex: Exercise): boolean {
  const keys = [ex.key, altKey(ex.key)];
  for (let i = 0; i < ex.sets; i++) if (!sets.some(s => keys.includes(s.exercise_key) && s.set_index === i)) return false;
  return true;
}

/** Hoy se hace la alternativa si ya hay alguna serie suya registrada. */
export const usesAlternative = (sets: WorkoutSet[], ex: Exercise) => sets.some(s => s.exercise_key === altKey(ex.key));
export const isDayDone = (sets: WorkoutSet[], day: WorkoutDay) => day.exercises.every(e => isExerciseDone(sets, e));

/** Misma serie de la última sesión (o la última registrada si entonces hubo menos series). */
export const lastSetAt = (last: LastSession | null, index: number) =>
  last?.sets.find(s => s.set_index === index) || last?.sets[last.sets.length - 1] || null;

/**
 * Valores con los que llega rellenada una serie.
 * Reps y RIR: misma serie de la última sesión, o la serie anterior de hoy.
 * Peso: el de la serie anterior de hoy si existe (respeta lo que se decidió hoy); si no, el de la última sesión.
 * Nunca aplica la sugerencia de progresión: la persona decide el peso.
 */
export function prefillFor(ex: Exercise, index: number, today: WorkoutSet[], last: LastSession | null): { weight: number | null; reps: number | null; rir: number | null; source: 'today' | 'last' | 'none' } {
  const prevToday = today.filter(s => s.exercise_key === ex.key && s.set_index < index).sort((a, b) => b.set_index - a.set_index)[0];
  const prevSet = lastSetAt(last, index);
  if (!prevToday && !prevSet) return { weight: null, reps: null, rir: null, source: 'none' };
  const ref = prevSet || prevToday!;
  return {
    weight: prevToday ? prevToday.weight : prevSet!.weight,
    reps: ref.reps,
    rir: ref.rir,
    source: prevSet ? 'last' : 'today'
  };
}

/* ---------- Progreso ---------- */

export interface ExerciseProgress {
  ex: Exercise;
  day: WorkoutDay;
  loaded: boolean;
  /** Es la alternativa de un ejercicio de la rutina. */
  isAlternative: boolean;
  last: number;
  max: number;
  /** Un punto por semana: [semana, valor máximo]. */
  weeks: [number, number][];
}

export const weekNumber = (date: Date | string, startDate: string) => {
  const start = toDate(startDate); start.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((+new Date(date) - +start) / (7 * DAY_MS)) + 1);
};

export function exerciseProgress(data: UserData, program: Program, startDate: string, dayFilter?: string | null): ExerciseProgress[] {
  const seen = new Set<string>();
  const out: ExerciseProgress[] = [];
  const ws = programWorkouts(data, program).slice().sort((a, b) => +new Date(a.started_at) - +new Date(b.started_at));
  for (const day of program.days) {
    if (dayFilter && day.id !== dayFilter) continue;
    // Cada ejercicio y, si se ha usado, su alternativa (con su propio historial)
    for (const ex of day.exercises.flatMap(e => [e, altExercise(e)])) {
      if (seen.has(ex.key)) continue;
      seen.add(ex.key);
      const sessions: { week: number; top: number; best: number }[] = [];
      for (const w of ws) {
        const ss = setsOf(data, w.id).filter(s => s.exercise_key === ex.key);
        if (!ss.length) continue;
        const sum = summarize(ss)!;
        sessions.push({ week: weekNumber(w.completed_at || w.started_at, startDate), top: sum.topWeight, best: Math.max(...sum.reps) });
      }
      if (!sessions.length) continue;
      const loaded = ex.unit !== 's' && sessions.some(s => s.top > 0);
      const metric = (s: { top: number; best: number }) => (loaded ? s.top : s.best);
      const weeks = new Map<number, number>();
      sessions.forEach(s => weeks.set(s.week, Math.max(weeks.get(s.week) ?? 0, metric(s))));
      out.push({
        ex: findExercise(program, ex.key) || ex, day, loaded, isAlternative: ex.key === altKey(ex.key),
        last: metric(sessions[sessions.length - 1]),
        max: Math.max(...sessions.map(metric)),
        weeks: [...weeks.entries()].sort((a, b) => a[0] - b[0])
      });
    }
  }
  return out;
}
