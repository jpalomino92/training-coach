import { describe, expect, it } from 'vitest';
import { routinePrograms } from '../../src/domain/routines';
import { needsWarmup, warmupSets } from '../../src/domain/warmup';
import { ex } from './helpers';

describe('calentamiento', () => {
  it('con barra: barra sola × 10, 50 % × 5, 70 % × 3, 85 % × 1', () => {
    expect(warmupSets(ex({ weightStep: 2.5 }), 100, 20)).toEqual([
      { weight: 20, reps: 10, barOnly: true }, { weight: 50, reps: 5 }, { weight: 70, reps: 3 }, { weight: 85, reps: 1 }
    ]);
  });
  it('redondea al paso y no repite pesos ni llega al de trabajo', () => {
    expect(warmupSets(ex({ weightStep: 2.5 }), 40, 20).map(s => s.weight)).toEqual([20, 27.5, 35]);
    expect(warmupSets(ex({ weightStep: 2.5 }), 20, 20)).toEqual([]);
  });
  it('mancuernas y máquinas: 50 % × 8 y 75 % × 4', () => {
    expect(warmupSets(ex({ weightStep: 1 }), 30)).toEqual([{ weight: 15, reps: 8 }, { weight: 23, reps: 4 }]);
    expect(warmupSets(ex({ weightStep: 1 }), 0)).toEqual([]);
  });
  it('solo en básicos con carga', () => {
    const TA = routinePrograms.maleUpperLower.days.find(d => d.id === 'TA')!.exercises;
    expect(needsWarmup(TA.find(e => e.key === 'bench_press')!)).toBe(true);
    expect(needsWarmup(TA.find(e => e.key === 'cable_lateral_raise')!)).toBe(false);
    expect(needsWarmup(ex({ compound: true, noWeight: true }))).toBe(false);
  });
});
