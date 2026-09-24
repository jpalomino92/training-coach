import { describe, expect, it } from 'vitest';
import { streak, weekStart, weeklyCounts, weeklyGoal } from '../../src/domain/consistency';
import { exportBodyWeightsCsv, exportSetsCsv, importBodyWeights, importExerciseSets, parseCsv, parseDate } from '../../src/domain/csv';
import { DEFAULT_PREFS, restClock, restFor } from '../../src/domain/prefs';
import { recordFor, recordSetIds } from '../../src/domain/records';
import { routinePrograms } from '../../src/domain/routines';
import type { UserData, Workout, WorkoutSet } from '../../src/domain/types';
import { DemoAuth } from '../../src/services/auth/demoAuth';

const P = routinePrograms.maleUpperLower;
const empty = (): UserData => ({ profile: null, workouts: [], sets: [], notes: {}, bodyWeights: [] });
const wk = (id: string, completed_at: string, day_id = 'PA', program_id = P.id): Workout => ({ id, user_id: 'u', program_id, day_id, status: 'completed', started_at: completed_at, completed_at, feel: {}, notes: '' });
const st = (id: string, workout_id: string, exercise_key: string, set_index: number, weight: number | null, reps: number): WorkoutSet => ({ id, user_id: 'u', workout_id, exercise_key, set_index, weight, reps, rir: 2, created_at: '', updated_at: '' });

describe('descanso personalizable', () => {
  const squat = P.days[0].exercises[0];   // básico, 150 s en la rutina
  const curl = P.days[0].exercises[3];    // accesorio, 90 s
  it('por defecto usa el descanso de la rutina', () => {
    expect(restFor(squat, DEFAULT_PREFS)).toBe(150);
    expect(restFor(curl, DEFAULT_PREFS)).toBe(90);
  });
  it('personalizado: básicos y accesorios por separado (p. ej. 2 y 1 minutos)', () => {
    const prefs = { ...DEFAULT_PREFS, rest_mode: 'custom' as const, rest_compound: 120, rest_accessory: 60 };
    expect(squat.compound).toBe(true);
    expect(restFor(squat, prefs)).toBe(120);
    expect(restFor(curl, prefs)).toBe(60);
  });
  it('limita los valores a 15 s–10 min y los muestra como reloj', () => {
    expect(restFor(squat, { ...DEFAULT_PREFS, rest_mode: 'custom', rest_compound: 5 })).toBe(15);
    expect(restFor(squat, { ...DEFAULT_PREFS, rest_mode: 'custom', rest_compound: 9999 })).toBe(600);
    expect(restClock(90)).toBe('1:30');
    expect(restClock(45)).toBe('45 s');
  });
  it('no modifica los datos de la rutina', () => {
    restFor(squat, { ...DEFAULT_PREFS, rest_mode: 'custom' });
    expect(squat.rest).toBe(150);
  });
});

describe('récords personales', () => {
  const ex = { unit: 'reps' as const };
  it('la primera vez no hay récord', () => {
    expect(recordFor(ex, { weight: 80, reps: 8 }, [])).toBeNull();
  });
  it('más peso que nunca', () => {
    expect(recordFor(ex, { weight: 82.5, reps: 6 }, [{ weight: 80, reps: 8 }])?.text).toBe('Nuevo récord de peso: 82,5 kg');
  });
  it('más repeticiones con ese peso o más', () => {
    expect(recordFor(ex, { weight: 80, reps: 9 }, [{ weight: 80, reps: 8 }, { weight: 70, reps: 12 }])?.kind).toBe('reps');
    expect(recordFor(ex, { weight: 70, reps: 11 }, [{ weight: 80, reps: 8 }, { weight: 70, reps: 12 }])).toBeNull();
  });
  it('igualar no es récord', () => {
    expect(recordFor(ex, { weight: 80, reps: 8 }, [{ weight: 80, reps: 8 }])).toBeNull();
  });
  it('ejercicios por tiempo', () => {
    expect(recordFor({ unit: 's' }, { weight: null, reps: 50 }, [{ weight: null, reps: 45 }])?.text).toBe('Nuevo récord: 50 s');
  });
  it('marca en el historial las series que fueron récord en su momento', () => {
    const list = [st('a', 'w1', 'k', 0, 80, 8), st('b', 'w2', 'k', 0, 85, 6), st('c', 'w3', 'k', 0, 82.5, 8), st('d', 'w4', 'k', 0, 90, 5)];
    // b: más peso · c: 8 reps con 82,5 kg supera las 6 hechas con 85 kg · d: más peso
    expect([...recordSetIds(ex as never, list)]).toEqual(['b', 'c', 'd']);
    const noRecord = [st('a', 'w1', 'k', 0, 80, 8), st('b', 'w2', 'k', 0, 80, 8), st('c', 'w3', 'k', 0, 75, 8)];
    expect([...recordSetIds(ex as never, noRecord)]).toEqual([]);
  });
});

describe('constancia semanal', () => {
  const now = new Date('2026-09-24T10:00:00').getTime(); // jueves
  it('la semana empieza el lunes', () => {
    expect(weekStart(now).getDay()).toBe(1);
    expect(weekStart(now).getDate()).toBe(21);
  });
  it('objetivo = días no opcionales de la rutina', () => {
    expect(weeklyGoal(routinePrograms.maleUpperLower)).toBe(4);
    expect(weeklyGoal(routinePrograms.femaleFatLossMuscle)).toBe(5);
    expect(weeklyGoal(routinePrograms.femaleMenopauseSafeStrength)).toBe(3);
  });
  it('cuenta entrenamientos completados por semana y la racha', () => {
    const ws = [
      ...['2026-09-08', '2026-09-09', '2026-09-10'].map((d, i) => wk(`a${i}`, `${d}T10:00:00`)),
      ...['2026-09-15', '2026-09-16', '2026-09-18'].map((d, i) => wk(`b${i}`, `${d}T10:00:00`)),
      wk('c', '2026-09-22T10:00:00'),
      { ...wk('x', '2026-09-23T10:00:00'), status: 'in_progress' as const }
    ];
    expect(weeklyCounts(ws, 3, now).map(w => w.count)).toEqual([3, 3, 1]);
    expect(streak(ws, 3, now)).toBe(2);   // esta semana aún no cuenta
    expect(streak(ws, 4, now)).toBe(0);
  });
});

describe('CSV', () => {
  it('lee ; , o tabulador, comillas y BOM', () => {
    expect(parseCsv('\uFEFFa;b\n1;"x;y"\r\n')).toEqual([['a', 'b'], ['1', 'x;y']]);
    expect(parseCsv('a,b\n"con ""comillas""",2')).toEqual([['a', 'b'], ['con "comillas"', '2']]);
    expect(parseCsv('a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('fechas dd/mm/aaaa, dd-mm-aa y aaaa-mm-dd; rechaza fechas imposibles', () => {
    expect(parseDate('21/09/2026')).toBe('2026-09-21');
    expect(parseDate('1-9-26')).toBe('2026-09-01');
    expect(parseDate('2026-09-21')).toBe('2026-09-21');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('ayer')).toBeNull();
  });

  it('peso corporal: coma decimal, nota, errores por línea y duplicados', () => {
    const data = { bodyWeights: [{ id: 'x', user_id: 'u', date: '2026-09-01', weight_kg: 78.4, note: '', created_at: '' }] };
    const r = importBodyWeights('Fecha;Peso;Nota\n01/09/2026;78,4;\n08/09/2026;77,9;En ayunas\nmañana;70;\n10/09/2026;abc;\n01/01/2099;70;', data, '2026-09-24');
    expect(r.rows).toEqual([{ date: '2026-09-08', weight_kg: 77.9, note: 'En ayunas' }]);
    expect(r.skipped).toBe(1);
    expect(r.errors.map(e => e.line)).toEqual([4, 5, 6]);
  });
  it('peso corporal: avisa si falta una columna', () => {
    expect(importBodyWeights('dia;kilos\n1/9/26;70', { bodyWeights: [] }).errors[0].message).toContain('peso');
  });

  it('ejercicios: nombre sin tildes, series numeradas, agrupados por fecha y día de la rutina', () => {
    const csv = 'fecha,ejercicio,serie,peso,reps,rir\n01/09/2026,Sentadilla con barra,1,80,8,2\n01/09/2026,sentadilla CON barra,2,80,7,1\n01/09/2026,Prensa,,120,12,\n03/09/2026,Press banca,1,60,8,2\n03/09/2026,Hip thrust con máquina,1,50,10,2';
    const r = importExerciseSets(csv, P, empty(), '2026-09-24');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 6 });
    expect(r.workouts.map(w => [w.date, w.dayId, w.sets.length])).toEqual([['2026-09-01', 'PA', 3], ['2026-09-03', 'TA', 1]]);
    expect(r.workouts[0].sets.map(s => [s.exercise.key, s.set_index, s.weight, s.reps, s.rir])).toEqual([
      ['squat_bar', 0, 80, 8, 2], ['squat_bar', 1, 80, 7, 1], ['leg_press', 0, 120, 12, null]
    ]);
    expect(r.setCount).toBe(4);
  });
  it('ejercicios: avisa si el ejercicio es de otra rutina y valida reps y RIR', () => {
    const r = importExerciseSets('fecha;ejercicio;reps;rir\n01/09/2026;Sentadilla en Smith;10;2\n01/09/2026;Press banca;99;2\n01/09/2026;Press banca;8;7', P, empty(), '2026-09-24');
    expect(r.errors.map(e => e.message)).toEqual([
      expect.stringContaining('es de otra rutina (Recomposición)'),
      expect.stringContaining('entre 1 y 50'),
      expect.stringContaining('entre 0 y 5')
    ]);
  });
  it('exportar e importar da los mismos datos (y reimportar no duplica)', () => {
    const d = empty();
    d.workouts = [wk('w1', '2026-09-01T12:00:00'), wk('w2', '2026-09-03T12:00:00', 'TA')];
    d.sets = [st('s1', 'w1', 'squat_bar', 0, 82.5, 8), st('s2', 'w1', 'squat_bar', 1, 82.5, 7), st('s3', 'w2', 'bench_press', 0, 60, 8)];
    d.bodyWeights = [{ id: 'b', user_id: 'u', date: '2026-09-02', weight_kg: 74.6, note: 'Con "comillas"; y punto y coma', created_at: '' }];
    const setsCsv = exportSetsCsv(d);
    const fresh = importExerciseSets(setsCsv, P, empty(), '2026-09-24');
    expect(fresh.errors).toEqual([]);
    expect(fresh.setCount).toBe(3);
    expect(fresh.workouts[0].sets[0]).toMatchObject({ weight: 82.5, reps: 8, rir: 2 });
    expect(importExerciseSets(setsCsv, P, d, '2026-09-24')).toMatchObject({ setCount: 0, skipped: 3 });
    const bw = importBodyWeights(exportBodyWeightsCsv(d), { bodyWeights: [] }, '2026-09-24');
    expect(bw.rows).toEqual([{ date: '2026-09-02', weight_kg: 74.6, note: 'Con "comillas"; y punto y coma' }]);
  });
});

describe('contraseña (modo demo)', () => {
  it('cambiar la contraseña exige la actual y deja entrar con la nueva', async () => {
    const auth = new DemoAuth(localStorage, 1000);
    await auth.signUp('ana@correo.com', 'contraseña-vieja');
    await expect(auth.updatePassword('contraseña-nueva', 'no-es')).rejects.toThrow('La contraseña actual no es correcta.');
    await expect(auth.updatePassword('corta', 'contraseña-vieja')).rejects.toThrow('al menos 8');
    await auth.updatePassword('contraseña-nueva', 'contraseña-vieja');
    await auth.signOut();
    await expect(auth.signIn('ana@correo.com', 'contraseña-vieja')).rejects.toThrow();
    expect((await auth.signIn('ana@correo.com', 'contraseña-nueva')).email).toBe('ana@correo.com');
  });
  it('recuperar por email no es posible en modo demo y lo explica', async () => {
    await expect(new DemoAuth(localStorage, 1000).requestPasswordReset()).rejects.toThrow('modo demo');
  });
});
