import { describe, expect, it } from 'vitest';
import { routinePrograms } from '../../src/domain/routines';
import type { UserData, Workout, WorkoutSet } from '../../src/domain/types';
import { activeWorkout, defaultDayId, exerciseProgress, isDayDone, lastSessionFor, lastUsedAlternative, prefillFor } from '../../src/domain/workout';

const P = routinePrograms.maleUpperLower;
const day = (iso: string) => new Date(iso).getTime();

const w = (id: string, day_id: string, status: Workout['status'], started_at: string, completed_at: string | null = null): Workout =>
  ({ id, user_id: 'u', program_id: P.id, day_id, status, started_at, completed_at, feel: {}, notes: '' });
const s = (workout_id: string, exercise_key: string, set_index: number, weight: number, reps: number, rir = 2): WorkoutSet =>
  ({ id: `${workout_id}-${exercise_key}-${set_index}`, user_id: 'u', workout_id, exercise_key, set_index, weight, reps, rir, created_at: '', updated_at: '' });
const data = (workouts: Workout[], sets: WorkoutSet[] = []): UserData => ({ profile: null, workouts, sets, notes: {}, bodyWeights: [] });

describe('historial entre rutinas', () => {
  const F = routinePrograms.femaleFatLossMuscle;
  it('un ejercicio que se repite en otra rutina sigue con su última sesión y su progreso', () => {
    const old: Workout = { ...w('f1', 'F1', 'completed', '2026-09-08T10:00:00', '2026-09-08T11:00:00'), program_id: F.id };
    const d = data([old], [s('f1', 'hip_thrust', 0, 60, 10)]);
    expect(lastSessionFor(d, 'hip_thrust')?.workout.id).toBe('f1');
    const pr = exerciseProgress(d, P, '2026-09-01').find(x => x.ex.key === 'hip_thrust');
    expect(pr).toMatchObject({ last: 60, day: { id: 'PB' } });
    // Los días de la otra rutina no cuentan como entrenamiento de esta
    expect(activeWorkout(d, P, 'F1', day('2026-09-08T12:00:00'))).toBeNull();
  });
});

describe('selectores de entrenamiento', () => {
  it('día por defecto: el primero si no hay nada', () => {
    expect(defaultDayId(data([]), P)).toBe('PA');
  });
  it('día por defecto: el que está en curso', () => {
    expect(defaultDayId(data([w('1', 'TA', 'in_progress', '2026-09-20T10:00:00')]), P)).toBe('TA');
  });
  it('día por defecto: el completado hoy, o el siguiente al último completado', () => {
    const d = data([w('1', 'PB', 'completed', '2026-09-20T10:00:00', '2026-09-20T11:00:00')]);
    expect(defaultDayId(d, P, day('2026-09-20T18:00:00'))).toBe('PB');
    expect(defaultDayId(d, P, day('2026-09-22T09:00:00'))).toBe('TB');
  });

  it('entrenamiento activo: en curso o completado esta semana', () => {
    const d = data([w('1', 'PA', 'completed', '2026-09-15T10:00:00', '2026-09-15T11:00:00')]); // martes
    expect(activeWorkout(d, P, 'PA', day('2026-09-15T20:00:00'))?.id).toBe('1');
    expect(activeWorkout(d, P, 'PA', day('2026-09-20T22:00:00'))?.id).toBe('1'); // domingo
    expect(activeWorkout(d, P, 'PA', day('2026-09-21T08:00:00'))).toBeNull(); // lunes siguiente
  });

  it('alternativa: se repite la modalidad de la última sesión del ejercicio', () => {
    const ex = P.days[0].exercises.find(e => e.alt)!;
    const d = data(
      [w('a', 'PA', 'completed', '2026-09-08T10:00:00', '2026-09-08T11:00:00'), w('b', 'PA', 'completed', '2026-09-15T10:00:00', '2026-09-15T11:00:00'), w('c', 'PA', 'in_progress', '2026-09-22T10:00:00')],
      [s('a', ex.key, 0, 50, 8), s('b', ex.key + '__alt', 0, 40, 10)]
    );
    expect(lastUsedAlternative(d, ex, 'c')).toBe(true);
    expect(lastUsedAlternative(d, ex, 'b')).toBe(false);
    expect(lastUsedAlternative(data([]), ex)).toBe(false);
  });

  it('última sesión excluye el entrenamiento de hoy', () => {
    const d = data(
      [w('old', 'PA', 'completed', '2026-09-10T10:00:00', '2026-09-10T11:00:00'), w('now', 'PA', 'in_progress', '2026-09-17T10:00:00')],
      [s('old', 'squat_bar', 0, 80, 8), s('now', 'squat_bar', 0, 82.5, 8)]
    );
    expect(lastSessionFor(d, 'squat_bar', 'now')!.workout.id).toBe('old');
  });

  it('relleno de serie: reps y RIR de la misma serie de la última sesión; peso de la serie anterior de hoy', () => {
    const ex = P.days[0].exercises[0];
    const last = { workout: w('old', 'PA', 'completed', ''), sets: [s('old', ex.key, 0, 80, 8, 2), s('old', ex.key, 1, 80, 7, 1)] };
    expect(prefillFor(ex, 0, [], last)).toMatchObject({ weight: 80, reps: 8, rir: 2, source: 'last' });
    const today = [s('now', ex.key, 0, 82.5, 8, 2)];
    expect(prefillFor(ex, 1, today, last)).toMatchObject({ weight: 82.5, reps: 7, rir: 1 });
    // Sin última sesión: la serie anterior de hoy
    expect(prefillFor(ex, 1, today, null)).toMatchObject({ weight: 82.5, reps: 8, source: 'today' });
    expect(prefillFor(ex, 0, [], null).source).toBe('none');
  });

  it('día completo cuando todas las series de todos los ejercicios están registradas', () => {
    const d = P.days[0];
    const all = d.exercises.flatMap(e => Array.from({ length: e.sets }, (_, i) => s('x', e.key, i, 10, 10)));
    expect(isDayDone(all, d)).toBe(true);
    expect(isDayDone(all.slice(1), d)).toBe(false);
  });

  it('progreso: un punto por semana con el peso máximo', () => {
    const d = data(
      [w('1', 'PA', 'completed', '2026-09-01T10:00:00'), w('2', 'PA', 'completed', '2026-09-03T10:00:00'), w('3', 'PA', 'completed', '2026-09-09T10:00:00')],
      [s('1', 'squat_bar', 0, 80, 8), s('2', 'squat_bar', 0, 82.5, 8), s('3', 'squat_bar', 0, 85, 6)]
    );
    const [pr] = exerciseProgress(d, P, '2026-09-01');
    expect(pr.ex.key).toBe('squat_bar');
    expect(pr.weeks).toEqual([[1, 82.5], [2, 85]]);
    expect(pr.last).toBe(85);
    expect(pr.max).toBe(85);
    expect(exerciseProgress(d, P, '2026-09-01', 'TA')).toHaveLength(0);
  });
});

describe('sistema de 2 series: relleno de la serie 2', () => {
  const e = { ...P.days.find(d => d.id === 'TA')!.exercises.find(x => x.key === 'cable_lateral_raise')! };
  const today = [s('now', e.key, 0, 20, 10, 0)];
  it('sin sesión anterior: un 35 % menos que la serie 1 de hoy', () => {
    expect(prefillFor(e, 1, today, null)).toMatchObject({ weight: 12.5, reps: null });
  });
  it('con sesión anterior: la serie 2 de la última vez', () => {
    const last = { workout: w('old', 'TA', 'completed', '2026-09-08T10:00:00', '2026-09-08T11:00:00'), sets: [s('old', e.key, 0, 20, 9, 0), s('old', e.key, 1, 12.5, 14, 0)] };
    expect(prefillFor(e, 1, today, last)).toMatchObject({ weight: 12.5, reps: 14 });
  });
});
