/* Resumen de un entrenamiento: duración, series, volumen, récords y
   comparación con la sesión anterior del mismo día de la rutina. */
import { resolveExercise } from './alternatives';
import { recordSetIds } from './records';
import { builtinLookup } from './routines';
import type { ProgramLookup, UserData, Workout } from './types';
import { totalSets } from './workout';

export interface WorkoutSummary {
  /** Minutos entre el inicio y el final (null si no es fiable). */
  minutes: number | null;
  sets: number;
  total: number;
  /** Kg × repeticiones de las series con carga (sin las de tiempo). */
  volume: number;
  previous: { date: string; volume: number; sets: number } | null;
  records: { name: string }[];
  pain: string[];
}

const when = (w: Workout) => +new Date(w.completed_at || w.started_at);

export function workoutSummary(data: UserData, w: Workout, lookup: ProgramLookup = builtinLookup): WorkoutSummary {
  const program = lookup(w.program_id);
  const day = program?.days.find(d => d.id === w.day_id);
  const sets = data.sets.filter(s => s.workout_id === w.id);
  const volumeOf = (list: typeof sets) => list.reduce((n, s) => {
    const ex = resolveExercise(program, s.exercise_key);
    return ex?.unit === 's' ? n : n + (s.weight || 0) * s.reps;
  }, 0);

  const minutes = w.completed_at ? Math.round((+new Date(w.completed_at) - +new Date(w.started_at)) / 60000) : null;

  const prevW = data.workouts
    .filter(x => x.id !== w.id && x.program_id === w.program_id && x.day_id === w.day_id && x.status === 'completed' && when(x) < when(w))
    .sort((a, b) => when(b) - when(a))[0];
  const prevSets = prevW ? data.sets.filter(s => s.workout_id === prevW.id) : [];

  // Récords de este entrenamiento, comparando con todo lo anterior de cada ejercicio
  const records: { name: string }[] = [];
  const keys = [...new Set(sets.map(s => s.exercise_key))];
  const programWorkouts = data.workouts.filter(x => x.program_id === w.program_id);
  const order = new Map(programWorkouts.map(x => [x.id, when(x)]));
  for (const key of keys) {
    const ex = resolveExercise(program, key);
    if (!ex) continue;
    const history = data.sets
      .filter(s => s.exercise_key === key && order.has(s.workout_id) && order.get(s.workout_id)! <= when(w))
      .sort((a, b) => (order.get(a.workout_id)! - order.get(b.workout_id)!) || a.set_index - b.set_index);
    const ids = recordSetIds(ex, history);
    if (sets.some(s => s.exercise_key === key && ids.has(s.id))) records.push({ name: ex.name });
  }

  const pain = Object.entries(w.feel || {}).filter(([, f]) => f === 'pain').map(([k]) => resolveExercise(program, k)?.name || k);

  return {
    minutes: minutes != null && minutes >= 1 && minutes <= 300 ? minutes : null,
    sets: sets.length,
    total: day ? totalSets(day) : sets.length,
    volume: Math.round(volumeOf(sets)),
    previous: prevW ? { date: prevW.completed_at || prevW.started_at, volume: Math.round(volumeOf(prevSets)), sets: prevSets.length } : null,
    records,
    pain
  };
}

/** "1 h 5 min", "48 min" */
export const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

/** "4.320" (separador de miles español) */
export const fmtThousands = (n: number) => Math.round(n).toLocaleString('es-ES');
