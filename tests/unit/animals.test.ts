import { describe, expect, it } from 'vitest';
import { animalFor, ANIMALS } from '../../src/domain/animals';
import { routinePrograms } from '../../src/domain/routines';
import { workoutSummary } from '../../src/domain/summary';
import type { UserData, WorkoutSet } from '../../src/domain/types';

describe('animal del resumen', () => {
  it('el más pesado que cabe al menos dos veces y cuántos son', () => {
    expect(animalFor(2850)?.text).toBe('2 morsas');
    expect(animalFor(1000)?.text).toBe('2 osos pardos');
    expect(animalFor(12000)?.text).toBe('2 elefantes');
    expect(animalFor(95)?.text).toBe('3 perros');
    expect(animalFor(5)?.text).toBe('1 gato');
  });
  it('sin peso suficiente no hay animal', () => {
    expect(animalFor(0)).toBeNull();
    expect(animalFor(3)).toBeNull();
  });
  it('la lista va de menor a mayor', () => {
    const kgs = ANIMALS.map(a => a.kg);
    expect(kgs).toEqual([...kgs].sort((a, b) => a - b));
  });
});

describe('volumen con bloques', () => {
  const P = routinePrograms.femaleMenopauseSafeStrength;
  const s = (exercise_key: string, weight: number, reps: number, i = 0): WorkoutSet =>
    ({ id: `${exercise_key}${i}`, user_id: 'u', workout_id: 'w', exercise_key, set_index: i, weight, reps, rir: 2, created_at: '', updated_at: '' });
  const data = (sets: WorkoutSet[]): UserData => ({
    profile: null, notes: {}, bodyWeights: [], sets,
    workouts: [{ id: 'w', user_id: 'u', program_id: P.id, day_id: 'S2', status: 'completed', started_at: '2026-10-20T10:00:00Z', completed_at: '2026-10-20T11:00:00Z', feel: {}, notes: '' }]
  });
  it('cada bloque cuenta como 5 kg y el volumen queda marcado como aproximado', () => {
    const sum = workoutSummary(data([s('sp_pushdown', 2, 12), s('sp_row_bilateral', 5, 8)]), data([]).workouts[0]);
    expect(sum.volume).toBe(2 * 5 * 12 + 5 * 8);
    expect(sum.approx).toBe(true);
  });
  it('solo kg: no es aproximado', () => {
    const sum = workoutSummary(data([s('sp_row_bilateral', 5, 8)]), data([]).workouts[0]);
    expect(sum).toMatchObject({ volume: 40, approx: false });
  });
});
