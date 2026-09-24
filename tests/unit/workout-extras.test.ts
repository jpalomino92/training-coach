import { describe, expect, it } from 'vitest';
import { altExercise, altKey, baseKey, isAltKey, resolveExercise } from '../../src/domain/alternatives';
import { exportSetsCsv, importExerciseSets } from '../../src/domain/csv';
import { platesFor, platesText } from '../../src/domain/plates';
import { suggest } from '../../src/domain/progression';
import { findExercise, routinePrograms } from '../../src/domain/routines';
import { workoutSummary } from '../../src/domain/summary';
import type { UserData, Workout, WorkoutSet } from '../../src/domain/types';
import { exerciseProgress, isDayDone, isExerciseDone, lastSessionFor, usesAlternative } from '../../src/domain/workout';

const P = routinePrograms.maleUpperLower;
const squat = findExercise(P, 'squat_bar')!;
const wk = (id: string, day_id: string, started: string, completed: string | null, over: Partial<Workout> = {}): Workout =>
  ({ id, user_id: 'u', program_id: P.id, day_id, status: completed ? 'completed' : 'in_progress', started_at: started, completed_at: completed, feel: {}, notes: '', ...over });
const st = (workout_id: string, exercise_key: string, set_index: number, weight: number | null, reps: number): WorkoutSet =>
  ({ id: `${workout_id}-${exercise_key}-${set_index}`, user_id: 'u', workout_id, exercise_key, set_index, weight, reps, rir: 2, created_at: '', updated_at: '' });
const data = (workouts: Workout[], sets: WorkoutSet[]): UserData => ({ profile: null, workouts, sets, notes: {}, bodyWeights: [] });

describe('alternativa del día', () => {
  it('la alternativa sale de los datos de la rutina, con clave propia', () => {
    const alt = altExercise(squat);
    expect(alt).toMatchObject({ key: 'squat_bar__alt', name: 'Sentadilla en Smith o hack', alt: 'Sentadilla con barra', sets: 4, rest: 150, cue: '', warn: '' });
    expect(isAltKey(alt.key)).toBe(true);
    expect(baseKey(alt.key)).toBe('squat_bar');
    expect(altKey(alt.key)).toBe(alt.key);
    expect(resolveExercise(P, 'squat_bar__alt')?.name).toBe('Sentadilla en Smith o hack');
    expect(squat.name).toBe('Sentadilla con barra'); // la rutina no cambia
  });

  it('las series de la alternativa completan el ejercicio y el día', () => {
    const day = P.days[0];
    const sets = day.exercises.flatMap(e => Array.from({ length: e.sets }, (_, i) => st('w', e.key === 'squat_bar' ? 'squat_bar__alt' : e.key, i, 10, 10)));
    expect(isExerciseDone(sets, squat)).toBe(true);
    expect(usesAlternative(sets, squat)).toBe(true);
    expect(isDayDone(sets, day)).toBe(true);
  });

  it('historial y sugerencia propios: no se mezclan con el ejercicio original', () => {
    const d = data(
      [wk('w1', 'PA', '2026-09-01T10:00:00', '2026-09-01T11:00:00'), wk('w2', 'PA', '2026-09-08T10:00:00', '2026-09-08T11:00:00')],
      [...[0, 1, 2, 3].map(i => st('w1', 'squat_bar', i, 100, 8)), ...[0, 1, 2, 3].map(i => st('w2', 'squat_bar__alt', i, 60, 8))]
    );
    expect(lastSessionFor(d, P, 'squat_bar')!.sets[0].weight).toBe(100);
    expect(lastSessionFor(d, P, 'squat_bar__alt')!.sets[0].weight).toBe(60);
    const alt = altExercise(squat);
    expect(suggest(alt, lastSessionFor(d, P, alt.key)!.sets, P).action).toBe('Sube a 62,5 kg.');
    const prog = exerciseProgress(d, P, '2026-09-01');
    expect(prog.map(p => [p.ex.name, p.isAlternative, p.max])).toEqual([['Sentadilla con barra', false, 100], ['Sentadilla en Smith o hack', true, 60]]);
  });

  it('CSV: reconoce el nombre de una alternativa y exporta con su nombre', () => {
    const r = importExerciseSets('fecha;ejercicio;reps\n01/09/2026;Remo en máquina;10', P, data([], []), '2026-09-24');
    expect(r.workouts[0].sets[0].exercise.key).toBe('row_bar__alt');
    expect(r.workouts[0].dayId).toBe('TA');
    const csv = exportSetsCsv(data([wk('w', 'PA', '2026-09-01T10:00:00', '2026-09-01T11:00:00')], [st('w', 'squat_bar__alt', 0, 60, 8)]));
    expect(csv).toContain('Sentadilla en Smith o hack;1;60;8');
  });
});

describe('resumen del entrenamiento', () => {
  it('duración, series, volumen, récords y comparación con la sesión anterior del mismo día', () => {
    const d = data(
      [
        wk('w1', 'PA', '2026-09-14T10:00:00', '2026-09-14T11:00:00'),
        wk('w2', 'PA', '2026-09-21T10:00:00', '2026-09-21T11:05:00', { feel: { leg_press: 'pain' } }),
        wk('x', 'TA', '2026-09-22T10:00:00', '2026-09-22T11:00:00')
      ],
      [
        st('w1', 'squat_bar', 0, 80, 8), st('w1', 'squat_bar', 1, 80, 8),
        st('w2', 'squat_bar', 0, 85, 8), st('w2', 'squat_bar', 1, 80, 8), st('w2', 'plank', 0, null, 45), st('w2', 'leg_press', 0, 100, 10)
      ]
    );
    const s = workoutSummary(d, d.workouts[1]);
    expect(s.minutes).toBe(65);
    expect(s.sets).toBe(4);
    expect(s.total).toBe(23);
    expect(s.volume).toBe(85 * 8 + 80 * 8 + 100 * 10); // la plancha (tiempo) no cuenta
    expect(s.previous).toMatchObject({ volume: 1280, sets: 2 });
    expect(s.records).toEqual([{ name: 'Sentadilla con barra' }]);
    expect(s.pain).toEqual(['Prensa']);
  });
  it('sin sesión anterior ni duración fiable', () => {
    const w = wk('w', 'PA', '2026-09-21T10:00:00', '2026-09-21T10:00:20');
    const s = workoutSummary(data([w], [st('w', 'squat_bar', 0, 80, 8)]), w);
    expect(s.previous).toBeNull();
    expect(s.minutes).toBeNull();
    expect(s.records).toEqual([]);
  });
});

describe('calculadora de discos', () => {
  it('discos por lado con barra de 20 kg', () => {
    expect(platesFor(100).perSide).toEqual([25, 15]);
    expect(platesFor(82.5).perSide).toEqual([25, 5, 1.25]);
    expect(platesText(82.5, 20)).toBe('Por lado: 25 + 5 + 1,25 (barra de 20 kg).');
  });
  it('solo la barra, menos que la barra y pesos que no se pueden cargar exactos', () => {
    expect(platesText(20, 20)).toBe('Solo la barra (20 kg).');
    expect(platesText(15, 20)).toBe('Menos que la barra sola (20 kg).');
    expect(platesText(81, 20)).toBe('Por lado: 25 + 5 (barra de 20 kg); no se llega exacto, faltan 1 kg.');
    expect(platesText(null, 20)).toBe('');
  });
  it('barra de 15 kg', () => {
    expect(platesFor(55, 15).perSide).toEqual([20]);
  });
});
