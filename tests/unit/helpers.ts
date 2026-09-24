import type { Exercise, Program } from '../../src/domain/types';

export function ex(over: Partial<Exercise> = {}): Exercise {
  return {
    key: 'lat_pulldown', name: 'Jalón', sets: 4, reps: { min: 8, max: 12 }, unit: 'reps', rir: '2', rest: 90,
    pose: 'pullup', muscle: 'Dorsales', cue: '', alt: '', perSide: false, warn: '', compound: false, weightStep: 2.5,
    ...over
  };
}

export const normalProg: Pick<Program, 'progression'> = { progression: { minRirToProgress: 1, cautious: false, step: '' } };
export const cautiousProg: Pick<Program, 'progression'> = { progression: { minRirToProgress: 2, cautious: true, step: '' } };

export const sets = (weight: number | null, reps: number[], rir: (number | null)[] | number | null) =>
  reps.map((r, i) => ({ set_index: i, weight, reps: r, rir: Array.isArray(rir) ? rir[i] : rir }));
