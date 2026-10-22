import { describe, expect, it } from 'vitest';
import { CARDIO_SLOT_KEY, countedSets, withCardio } from '../../src/domain/cardio';
import { findExerciseAnywhere, routinePrograms } from '../../src/domain/routines';
import type { WorkoutSet } from '../../src/domain/types';
import { isDayDone, isExerciseDone } from '../../src/domain/workout';

const s = (exercise_key: string, set_index: number, reps = 10): WorkoutSet =>
  ({ id: `${exercise_key}${set_index}`, user_id: 'u', workout_id: 'w', exercise_key, set_index, weight: null, reps, rir: null, created_at: '', updated_at: '' });

describe('cardio final', () => {
  it('se añade al final de cada día, salvo en la rutina del especialista', () => {
    const P = withCardio(routinePrograms.maleUpperLower);
    for (const d of P.days) expect(d.exercises.at(-1)?.key, d.id).toBe(CARDIO_SLOT_KEY);
    expect(withCardio(routinePrograms.maleUpperLower)).toBe(P); // misma referencia: no rompe memos
    expect(withCardio(routinePrograms.femaleMenopauseSafeStrength)).toBe(routinePrograms.femaleMenopauseSafeStrength);
    expect(routinePrograms.maleUpperLower.days[0].exercises.at(-1)?.key).not.toBe(CARDIO_SLOT_KEY); // la rutina original no cambia
  });

  it('hecho con el primer tramo de cualquier máquina; varios tramos cuentan como una serie', () => {
    const slot = withCardio(routinePrograms.maleUpperLower).days[0].exercises.at(-1)!;
    expect(isExerciseDone([], slot)).toBe(false);
    const sets = [s('cardio_stairs', 0, 5), s('cardio_bike', 1, 10), s('cardio_treadmill', 2, 6)];
    expect(isExerciseDone(sets, slot)).toBe(true);
    expect(countedSets([...sets, s('squat_bar', 0)])).toBe(2);
  });

  it('el día no está completo sin el cardio', () => {
    const day = withCardio(routinePrograms.maleUpperLower).days[0];
    const strength = day.exercises.filter(e => !e.cardioSlot).flatMap(e => Array.from({ length: e.sets }, (_, i) => s(e.key, i)));
    expect(isDayDone(strength, day)).toBe(false);
    expect(isDayDone([...strength, s('cardio_bike', 0)], day)).toBe(true);
  });

  it('el historial reconoce cada máquina en minutos', () => {
    expect(findExerciseAnywhere('cardio_stairs')).toMatchObject({ name: 'Escaladora', unit: 'min' });
  });
});
