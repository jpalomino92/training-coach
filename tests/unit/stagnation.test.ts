import { describe, expect, it } from 'vitest';
import { activePlan, deloadWeight, isDeloadWorkout, shouldSuggestDeload, stallFor, weeksSinceDeload } from '../../src/domain/stagnation';
import type { UserData, Workout, WorkoutSet } from '../../src/domain/types';
import { ex } from './helpers';

const w = (id: string, d: Date): Workout =>
  ({ id, user_id: 'u', program_id: 'maleUpperLower', day_id: 'TA', status: 'completed', started_at: d.toISOString(), completed_at: d.toISOString(), feel: {}, notes: '' });
const s = (workout_id: string, weight: number, reps: number, key = 'bench'): WorkoutSet =>
  ({ id: `${workout_id}-${key}`, user_id: 'u', workout_id, exercise_key: key, set_index: 0, weight, reps, rir: 2, created_at: '', updated_at: '' });
/** Una sesión por semana desde el lunes 7/9/2026 con estos pesos × reps. */
const weekly = (sets: [number, number][]): UserData => {
  const ws = sets.map((_, i) => w(`w${i}`, new Date(2026, 8, 7 + i * 7, 10)));
  return { profile: null, notes: {}, bodyWeights: [], workouts: ws, sets: sets.map(([kg, r], i) => s(`w${i}`, kg, r)) };
};
const bench = ex({ key: 'bench', weightStep: 2.5 });
const NOW = new Date(2026, 9, 26, 12).getTime(); // lunes 26/10, 7 semanas después

describe('estancamiento', () => {
  it('progresando no avisa', () => {
    expect(stallFor(weekly([[60, 8], [62.5, 8], [65, 8], [67.5, 8], [70, 8]]), bench, {}, NOW)).toBeNull();
  });

  it('3 semanas y 3 sesiones sin superar la mejor marca: avisa y propone bajar un 10 %', () => {
    const st = stallFor(weekly([[60, 8], [65, 8], [70, 8], [70, 8], [70, 7], [70, 8]]), bench, {}, NOW);
    expect(st).toMatchObject({ sessions: 3, best: { weight: 70, reps: 8 }, resetWeight: 62.5 });
    expect(st!.weeks).toBeGreaterThanOrEqual(3);
  });

  it('con un plan en marcha (4 semanas) no avisa; después del plan, la cuenta empieza de cero', () => {
    const d = weekly([[60, 8], [65, 8], [70, 8], [70, 8], [70, 7], [70, 8]]);
    const recent = { bench: { plan: 'dismiss' as const, at: new Date(2026, 9, 20).toISOString() } };
    expect(stallFor(d, bench, { stall_plans: recent }, NOW)).toBeNull();
    expect(activePlan({ stall_plans: recent }, 'bench', NOW)?.plan).toBe('dismiss');
    const old = { bench: { plan: 'reset' as const, at: new Date(2026, 8, 1).toISOString(), weight: 60 } };
    expect(activePlan({ stall_plans: old }, 'bench', NOW)).toBeNull();
  });

  it('las semanas de descarga no cuentan', () => {
    const d = weekly([[60, 8], [65, 8], [70, 8], [70, 8], [63, 8], [70, 8]]);
    const prefs = { deload_weeks: ['2026-10-05', '2026-10-12', '2026-10-19'] };
    expect(isDeloadWorkout(prefs)(d.workouts[4])).toBe(true);
    expect(stallFor(d, bench, prefs, NOW)).toBeNull(); // quedan pocas sesiones válidas
  });

  it('el cardio nunca se marca como estancado', () => {
    expect(stallFor(weekly([[0, 10], [0, 10], [0, 10], [0, 10], [0, 10]]), ex({ key: 'bench', unit: 'min' }), {}, NOW)).toBeNull();
  });
});

describe('semana de descarga', () => {
  const d = weekly([[60, 8], [62.5, 8], [65, 8], [67.5, 8], [70, 8], [72.5, 8], [75, 8]]); // 7 semanas: 7/9 → 19/10
  it('se propone tras 7 semanas seguidas entrenando', () => {
    expect(weeksSinceDeload(d, {}, NOW)).toBe(7);
    expect(shouldSuggestDeload(d, {}, NOW)).toBe(7);
  });
  it('no se propone si ya se descartó esta semana o si hubo una descarga reciente', () => {
    expect(shouldSuggestDeload(d, { deload_dismissed: '2026-10-26' }, NOW)).toBeNull();
    expect(shouldSuggestDeload(d, { deload_weeks: ['2026-10-05'] }, NOW)).toBeNull();
    expect(weeksSinceDeload(d, { deload_weeks: ['2026-10-05'] }, NOW)).toBe(2);
  });
  it('peso de descarga: un 10 % menos, redondeado al paso', () => {
    expect(deloadWeight({ weightStep: 2.5 }, 100)).toBe(90);
    expect(deloadWeight({ weightStep: 1 }, 12)).toBe(11);
  });
});
