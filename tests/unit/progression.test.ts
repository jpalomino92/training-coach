import { describe, expect, it } from 'vitest';
import { suggest, summarize } from '../../src/domain/progression';
import { routinePrograms, findExercise } from '../../src/domain/routines';
import { cautiousProg, ex, normalProg, sets } from './helpers';

describe('doble progresión', () => {
  it('primera vez: sin series previas da una indicación para elegir peso', () => {
    const s = suggest(ex(), [], normalProg);
    expect(s.level).toBe('none');
    expect(s.reason).toContain('8-12 repeticiones');
    expect(s.reason).toContain('2 en reserva');
  });

  it('subir: todas las series al máximo del rango con el RIR indicado', () => {
    const s = suggest(ex(), sets(40, [12, 12, 12, 12], 2), normalProg);
    expect(s.level).toBe('up');
    expect(s.action).toBe('Sube a 42,5 kg.');
    expect(s.reason).toContain('12 / 12 / 12 / 12 con RIR 2');
    expect(s.weight).toBe(42.5);
  });

  it('mantener: en el rango pero sin llegar al máximo en todas', () => {
    const s = suggest(ex(), sets(40, [12, 11, 10, 10], 2), normalProg);
    expect(s.level).toBe('hold');
    expect(s.action).toBe('Mantén 40 kg.');
    expect(s.reason).toBe('Cuando hagas 12 repeticiones en todas las series, sube a 42,5 kg.');
  });

  it('mantener: máximo de reps pero con RIR por debajo del mínimo para progresar', () => {
    const s = suggest(ex(), sets(40, [12, 12, 12, 12], [1, 1, 0, 0]), normalProg);
    expect(s.level).toBe('hold');
    expect(s.reason).toContain('RIR por debajo de 1');
  });

  it('mantener: sin RIR anotado pide anotarlo', () => {
    const s = suggest(ex(), sets(40, [12, 12, 12, 12], null), normalProg);
    expect(s.level).toBe('hold');
    expect(s.reason).toContain('Anota el RIR');
  });

  it('mantener: si faltaron series no sugiere subir', () => {
    const s = suggest(ex(), sets(40, [12, 12], 3), normalProg);
    expect(s.level).toBe('hold');
    expect(s.reason).toContain('Completa todas las series');
  });

  it('bajar: alguna serie por debajo del mínimo del rango', () => {
    const s = suggest(ex(), sets(40, [10, 9, 8, 7], [2, 2, 1, 1]), normalProg);
    expect(s.level).toBe('down');
    expect(s.action).toBe('Baja a 37,5 kg.');
    expect(s.reason).toContain('mínimo de 8');
  });

  it('bajar: RIR 0 antes del mínimo del rango', () => {
    const s = suggest(ex(), sets(40, [10, 9, 8, 8], [2, 1, 0, 0]), normalProg);
    expect(s.level).toBe('down');
    expect(s.reason).toContain('RIR 0 con 8 repeticiones');
  });

  it('bajar: nunca sugiere un peso negativo', () => {
    const s = suggest(ex({ weightStep: 2.5 }), sets(1, [5, 5, 5, 5], 0), normalProg);
    expect(s.weight).toBe(0);
  });

  it('dolor: tiene prioridad aunque tocara subir', () => {
    const s = suggest(ex(), sets(40, [12, 12, 12, 12], 3), normalProg, 'pain');
    expect(s.level).toBe('pain');
    expect(s.action).toBe('No aumentes el peso.');
    expect(s.reason).toContain('detente');
  });

  it('molestia muscular normal no bloquea la progresión', () => {
    expect(suggest(ex(), sets(40, [12, 12, 12, 12], 2), normalProg, 'muscle').level).toBe('up');
  });

  it('programa cauteloso: solo el incremento mínimo y solo si no hubo dolor', () => {
    const e = ex({ weightStep: 1, rir: '3' });
    const s = suggest(e, sets(30, [12, 12, 12, 12], 3), cautiousProg);
    expect(s.level).toBe('up');
    expect(s.action).toBe('Podrías subir a 31 kg, solo si no hubo dolor.');
    expect(s.reason).toContain('incremento mínimo (1 kg)');
  });

  it('programa cauteloso: RIR por debajo de 2 no progresa', () => {
    const s = suggest(ex({ weightStep: 1 }), sets(30, [12, 12, 12, 12], [2, 2, 1, 1]), cautiousProg);
    expect(s.level).toBe('hold');
  });

  it('programa cauteloso: RIR bajo dentro del rango sugiere mantener o bajar', () => {
    const s = suggest(ex({ weightStep: 1 }), sets(30, [11, 10, 10, 10], [2, 1, 1, 1]), cautiousProg);
    expect(s.level).toBe('down');
    expect(s.action).toBe('Mantén 30 kg o baja a 29 kg.');
    expect(s.reason).toContain('2–4 repeticiones en reserva');
  });

  it('weightStep del ejercicio: mancuernas suben de 1 en 1', () => {
    const curl = findExercise(routinePrograms.maleUpperLower, 'curl_db')!;
    expect(curl.weightStep).toBe(1);
    const s = suggest(curl, sets(12, [12, 12, 12], 2), routinePrograms.maleUpperLower);
    expect(s.action).toBe('Sube a 13 kg.');
  });

  it('weightStep por defecto: 2,5 kg', () => {
    const bench = findExercise(routinePrograms.maleUpperLower, 'bench_press')!;
    expect(bench.weightStep).toBe(2.5);
    expect(suggest(bench, sets(60, [8, 8, 8, 8], 2), routinePrograms.maleUpperLower).action).toBe('Sube a 62,5 kg.');
  });

  it('ejercicios por tiempo no hablan de kilos', () => {
    const plank = findExercise(routinePrograms.maleUpperLower, 'plank')!;
    const s = suggest(plank, sets(null, [45, 45, 45], 2), routinePrograms.maleUpperLower);
    expect(s.level).toBe('up');
    expect(s.action).not.toContain('kg');
  });

  it('summarize: peso máximo, reps en orden y RIR final', () => {
    const sum = summarize([{ set_index: 1, weight: 42.5, reps: 10, rir: 1 }, { set_index: 0, weight: 40, reps: 12, rir: 2 }])!;
    expect(sum.topWeight).toBe(42.5);
    expect(sum.reps).toEqual([12, 10]);
    expect(sum.finalRir).toBe(1);
    expect(sum.minRir).toBe(1);
  });
});
