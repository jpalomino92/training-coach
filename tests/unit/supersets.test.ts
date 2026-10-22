import { describe, expect, it } from 'vitest';
import { canPair, dayUnits, nextTurn, withGroup, withoutUnit, withPair } from '../../src/domain/supersets';
import type { WorkoutDay, WorkoutSet } from '../../src/domain/types';
import { ex } from './helpers';

const day: WorkoutDay = {
  id: 'D1', name: 'Día 1', focus: '', color: 'red', exercises: [
    ex({ key: 'squat', compound: true, rest: 180 }),
    ex({ key: 'a', sets: 3, group: 'g' }),
    ex({ key: 'b', sets: 3, group: 'g' }),
    ex({ key: 'curl', sets: 3 }),
    ex({ key: 'pushdown', sets: 2 }),
    ex({ key: 'walk', unit: 'min', sets: 1 })
  ]
};
const keys = (d = {}) => dayUnits(day, d).map(u => u.exercises.map(e => e.key));
const set = (exercise_key: string, set_index: number): WorkoutSet =>
  ({ id: `${exercise_key}${set_index}`, user_id: 'u', workout_id: 'w', exercise_key, set_index, weight: 10, reps: 10, rir: 2, created_at: '', updated_at: '' });

describe('biseries', () => {
  it('agrupa los ejercicios seguidos del mismo grupo de la rutina', () => {
    expect(keys()).toEqual([['squat'], ['a', 'b'], ['curl'], ['pushdown'], ['walk']]);
  });

  it('la persona puede unir dos ejercicios seguidos y volver a separarlos', () => {
    const sp = withPair({}, 'curl', 'pushdown');
    expect(keys(sp)).toEqual([['squat'], ['a', 'b'], ['curl', 'pushdown'], ['walk']]);
    const u = dayUnits(day, sp)[2];
    expect(u.source).toBe('user');
    expect(keys(withoutUnit(sp, u))).toEqual(keys());
  });

  it('el grupo de la rutina se puede hacer por separado y recuperar', () => {
    const u = dayUnits(day)[1];
    const sp = withoutUnit({}, u);
    expect(keys(sp)).toEqual([['squat'], ['a'], ['b'], ['curl'], ['pushdown'], ['walk']]);
    expect(keys(withGroup(sp, 'g'))).toEqual(keys());
  });

  it('ni el cardio ni los básicos pesados ni los grupos de la rutina se unen', () => {
    const u = dayUnits(day);
    expect(canPair(u[2], u[3])).toBe(true);
    expect(canPair(u[3], u[4])).toBe(false); // cardio
    expect(canPair(u[0], u[1])).toBe(false); // básico pesado y grupo
    expect(canPair(u[4], undefined)).toBe(false);
  });

  it('una pareja que ya no es contigua se ignora', () => {
    expect(keys(withPair({}, 'curl', 'walk'))).toEqual(keys());
  });

  it('turnos: vuelta a vuelta y, en cada vuelta, en orden', () => {
    const [a, b] = day.exercises.slice(1, 3);
    expect(nextTurn([a, b], [])).toEqual({ ex: a, set: 0 });
    expect(nextTurn([a, b], [set('a', 0)])).toEqual({ ex: b, set: 0 });
    expect(nextTurn([a, b], [set('a', 0), set('b__alt', 0)])).toEqual({ ex: a, set: 1 });
    expect(nextTurn([a, b], [0, 1, 2].flatMap(i => [set('a', i), set('b', i)]))).toBeNull();
  });

  it('con distinto número de series, las vueltas finales solo tienen el que sigue', () => {
    const curl = day.exercises[3], push = day.exercises[4];
    expect(nextTurn([curl, push], [0, 1].flatMap(i => [set('curl', i), set('pushdown', i)]))).toEqual({ ex: curl, set: 2 });
  });
});
