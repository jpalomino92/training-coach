import { describe, expect, it } from 'vitest';
import { compareSet, exerciseMood, exerciseVersus, ghostFor, ghostStats, ghostTarget, moodFor, setVersus, workoutVersus } from '../../src/domain/ghost';
import { findExerciseAnywhere } from '../../src/domain/routines';
import type { UserData, Workout, WorkoutSet } from '../../src/domain/types';
import { ex } from './helpers';

const w = (id: string, iso: string, status: Workout['status'] = 'completed'): Workout =>
  ({ id, user_id: 'u', program_id: 'maleUpperLower', day_id: 'TA', status, started_at: iso, completed_at: status === 'completed' ? iso : null, feel: {}, notes: '' });
const s = (workout_id: string, key: string, i: number, weight: number | null, reps: number): WorkoutSet =>
  ({ id: `${workout_id}-${key}-${i}`, user_id: 'u', workout_id, exercise_key: key, set_index: i, weight, reps, rir: 2, created_at: '', updated_at: '' });
const data = (workouts: Workout[], sets: WorkoutSet[]): UserData => ({ profile: null, notes: {}, bodyWeights: [], workouts, sets });
const NOW = new Date('2026-10-23T10:00:00').getTime();

describe('fantasma', () => {
  it('elige la sesión más reciente de hace al menos ~4 semanas', () => {
    const d = data(
      [w('a', '2026-09-01T10:00:00'), w('b', '2026-09-22T10:00:00'), w('c', '2026-10-16T10:00:00')],
      [s('a', 'bench', 0, 60, 8), s('b', 'bench', 0, 65, 8), s('c', 'bench', 0, 70, 8)]
    );
    expect(ghostFor(d, 'bench', null, NOW)?.workout.id).toBe('b');
  });

  it('sin un mes de historial: la sesión más antigua de una semana anterior; nada si solo hay de esta semana', () => {
    const d = data([w('b', '2026-10-09T10:00:00'), w('c', '2026-10-16T10:00:00'), w('d', '2026-10-21T10:00:00')],
      [s('b', 'bench', 0, 60, 8), s('c', 'bench', 0, 65, 8), s('d', 'bench', 0, 70, 8)]);
    expect(ghostFor(d, 'bench', null, NOW)?.workout.id).toBe('b');
    expect(ghostFor(data([w('d', '2026-10-21T10:00:00')], [s('d', 'bench', 0, 70, 8)]), 'bench', null, NOW)).toBeNull();
  });

  it('no usa entrenamientos en curso ni el de hoy', () => {
    const d = data([w('a', '2026-09-20T10:00:00', 'in_progress')], [s('a', 'bench', 0, 60, 8)]);
    expect(ghostFor(d, 'bench', null, NOW)).toBeNull();
    expect(ghostFor(data([w('a', '2026-09-20T10:00:00')], [s('a', 'bench', 0, 60, 8)]), 'bench', 'a', NOW)).toBeNull();
  });

  it('compara series: mismo peso por repeticiones, distinto peso por 1RM estimado', () => {
    const e = ex();
    expect(setVersus(e, { weight: 60, reps: 10 }, { weight: 60, reps: 8 })).toEqual({ result: 'win', text: 'Le ganas a Rocky por 2 repeticiones' });
    expect(setVersus(e, { weight: 60, reps: 7 }, { weight: 60, reps: 8 })).toEqual({ result: 'lose', text: 'Rocky iba 1 repetición por delante (60 kg × 8)' });
    expect(compareSet(e, { weight: 65, reps: 6 }, { weight: 60, reps: 8 })).toBe('win'); // 78 > 76
    expect(setVersus(e, { weight: 60, reps: 8 }, { weight: 60, reps: 8 }).result).toBe('tie');
    expect(compareSet(ex({ unit: 's' }), { weight: null, reps: 40 }, { weight: null, reps: 30 })).toBe('win');
  });

  it('el ejercicio se decide por la mejor serie; el objetivo de cada serie', () => {
    expect(exerciseVersus(ex(), [{ weight: 60, reps: 8 }, { weight: 62.5, reps: 8 }], [{ weight: 62.5, reps: 7 }])).toBe('win');
    const g = { workout: w('a', '2026-09-20T10:00:00'), sets: [s('a', 'bench', 0, 60, 8)] };
    expect(ghostTarget(ex(), g, 0)).toBe('Rocky: 60 kg × 8');
    expect(ghostTarget(ex(), g, 1)).toBeUndefined();
  });

  it('resumen del entrenamiento: en cuántos ejercicios le ganaste, sin contar el cardio', () => {
    const today = { ...w('t', '2026-10-23T10:00:00'), status: 'completed' as const };
    const d = data([w('a', '2026-09-22T10:00:00'), today], [
      s('a', 'bench_press', 0, 60, 8), s('a', 'row_bar', 0, 60, 10),
      s('t', 'bench_press', 0, 62.5, 8), s('t', 'row_bar', 0, 60, 9), s('t', 'curl_db', 0, 12, 10), s('t', 'cardio_bike', 0, null, 10)
    ]);
    expect(workoutVersus(d, today, findExerciseAnywhere)).toEqual({ wins: 1, ties: 0, total: 2 });
  });
});

describe('fantasma como mascota', () => {
  const resolveFor = () => findExerciseAnywhere;
  it('humor: sobrado si pierdes, asustado si ganas, derrotado si ganas en todo', () => {
    expect(moodFor(0, 2)).toBe('smug');
    expect(moodFor(2, 1, 4)).toBe('scared');
    expect(moodFor(3, 0, 3)).toBe('beaten');
    expect(moodFor(1, 1)).toBe('rival');
    expect(exerciseMood({ wins: 1, losses: 0 }, false)).toBe('scared');
    expect(exerciseMood({ wins: 3, losses: 0 }, true)).toBe('beaten');
  });
  it('sube un nivel por cada semana que le ganas y cuenta la racha', () => {
    // Press banca semanal: 60 → 60 → 65 → 70 → 72,5
    const kg = [60, 60, 65, 70, 72.5];
    const ws = kg.map((_, i) => w(`w${i}`, new Date(2026, 8, 1 + i * 7, 10).toISOString()));
    const d = data(ws, kg.map((k, i) => s(`w${i}`, 'bench_press', 0, k, 8)));
    const st = ghostStats(d, resolveFor, new Date(2026, 9, 2).getTime());
    // w1 empata contra w0; w2, w3 y w4 le ganan a la sesión más antigua o a la de hace un mes
    expect(st).toMatchObject({ weeksWon: 3, level: 4, streak: 3, mood: 'beaten', idleDays: 2 });
  });
  it('se pone triste tras 10 días sin entrenar', () => {
    const d = data([w('a', '2026-09-01T10:00:00')], [s('a', 'bench_press', 0, 60, 8)]);
    expect(ghostStats(d, resolveFor, new Date('2026-09-20T10:00:00').getTime())).toMatchObject({ mood: 'sad', level: 1, streak: 0, lastWeek: null });
  });
});
