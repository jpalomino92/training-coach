import { describe, expect, it } from 'vitest';
import { altExercise } from '../../src/domain/alternatives';
import { dailyCheer, weekCheer } from '../../src/domain/cheer';
import { setText } from '../../src/domain/format';
import { gearFor } from '../../src/domain/gear';
import { compareSet } from '../../src/domain/ghost';
import { suggest } from '../../src/domain/progression';
import { recordFor } from '../../src/domain/records';
import { importRoutine } from '../../src/domain/routineImport';
import { findExercise, routinePrograms } from '../../src/domain/routines';
import { deloadWeight } from '../../src/domain/stagnation';
import { workoutSummary } from '../../src/domain/summary';
import type { UserData, Workout, WorkoutSet } from '../../src/domain/types';
import { warmedUpBefore } from '../../src/domain/warmup';
import { STALE_HOURS, staleWorkouts } from '../../src/domain/workout';
import { ex, normalProg, sets } from './helpers';

const P = routinePrograms.maleUpperLower;
const wk = (id: string, started: string, completed: string | null, over: Partial<Workout> = {}): Workout =>
  ({ id, user_id: 'u', program_id: P.id, day_id: 'PA', status: completed ? 'completed' : 'in_progress', started_at: started, completed_at: completed, feel: {}, notes: '', ...over });
const st = (workout_id: string, at: string, set_index = 0, weight: number | null = 40, reps = 10, key = 'squat_bar'): WorkoutSet =>
  ({ id: `${workout_id}-${key}-${set_index}`, user_id: 'u', workout_id, exercise_key: key, set_index, weight, reps, rir: 2, created_at: at, updated_at: at });
const data = (workouts: Workout[], s: WorkoutSet[] = []): UserData => ({ profile: null, workouts, sets: s, notes: {}, bodyWeights: [] });

describe('calentamiento solo en el primer ejercicio de cada músculo', () => {
  it('la prensa tras la sentadilla no calienta; el peso muerto rumano (otro músculo) sí', () => {
    const PA = P.days.find(d => d.id === 'PA')!.exercises;
    const get = (k: string) => PA.find(e => e.key === k)!;
    expect(warmedUpBefore(PA, get('squat_bar'))).toBe(false);
    expect(warmedUpBefore(PA, get('rdl_bar'))).toBe(false);
    expect(warmedUpBefore(PA, get('leg_press'))).toBe(true);
  });
  it('un aislamiento antes no cuenta: el básico de después mantiene su calentamiento', () => {
    const list = [ex({ key: 'a', muscle: 'Cuádriceps', compound: false }), ex({ key: 'b', muscle: 'Cuádriceps y glúteo', compound: true })];
    expect(warmedUpBefore(list, list[1])).toBe(false);
  });
});

describe('qué llevar hoy', () => {
  it('agua y toalla siempre; guantes si hay agarre y esterilla si hay suelo', () => {
    const ids = (exs: ReturnType<typeof ex>[]) => gearFor({ exercises: exs }).map(g => g.id);
    expect(ids([ex({ name: 'Prensa', pose: 'legpress' })])).toEqual(['agua', 'toalla']);
    const PA = P.days.find(d => d.id === 'PA')!;
    const gear = gearFor(PA);
    expect(gear.map(g => g.id)).toEqual(['agua', 'toalla', 'guantes']);
    expect(gear[2].why).toBe('Para el agarre en Peso muerto rumano.');
    expect(ids([ex({ name: 'Plancha', pose: 'plank' })])).toContain('esterilla');
  });
  it('tobillera en la polea; pesoneras solo sin máquina, polea ni banda', () => {
    const ids = (exs: ReturnType<typeof ex>[]) => gearFor({ exercises: exs }).map(g => g.id);
    expect(ids([ex({ name: 'Patada atrás en polea', pose: 'kickback' })])).toContain('tobillera');
    expect(ids([ex({ name: 'Patada de glúteo en cuadrupedia', pose: 'kickback' })])).toEqual(expect.arrayContaining(['pesoneras', 'esterilla']));
    expect(ids([ex({ name: 'Abducción inclinada', pose: 'abductor', load: 'bloques' })])).not.toContain('pesoneras');
    expect(ids([ex({ name: 'Patada con banda', pose: 'kickback' })])).toEqual(['agua', 'toalla', 'banda']);
  });
});

describe('cierre automático de entrenamientos olvidados', () => {
  const now = +new Date('2026-10-28T20:00:00Z');
  it(`se cierra tras ${STALE_HOURS} h sin actividad, con la hora de la última serie`, () => {
    const d = data(
      [wk('w1', '2026-10-28T10:00:00Z', null), wk('w2', '2026-10-28T17:00:00Z', null), wk('w3', '2026-10-27T10:00:00Z', '2026-10-27T11:00:00Z')],
      [st('w1', '2026-10-28T10:20:00Z', 0), st('w1', '2026-10-28T11:05:00Z', 1), st('w2', '2026-10-28T17:30:00Z')]
    );
    expect(staleWorkouts(d, now)).toEqual([{ workout: d.workouts[0], completedAt: '2026-10-28T11:05:00.000Z' }]);
  });
  it('sin series cuenta la hora de inicio', () => {
    expect(staleWorkouts(data([wk('w1', '2026-10-28T15:30:00Z', null)]), now)).toHaveLength(1);
    expect(staleWorkouts(data([wk('w1', '2026-10-28T16:30:00Z', null)]), now)).toHaveLength(0);
  });
});

describe('Rocky anima a seguir', () => {
  const now = +new Date('2026-10-29T12:00:00'); // jueves
  const done = (iso: string) => wk(iso, iso, iso);
  it('según la semana: primero, faltan, hoy ya entrenaste, semana cumplida y días sin venir', () => {
    expect(dailyCheer([], 4, 'Pierna A', now)).toEqual({ pose: 'flex', text: '¡Tu primer entrenamiento! Empieza por Pierna A.' });
    expect(dailyCheer([done('2026-10-27T10:00:00')], 4, 'Torso A', now).text).toBe('Te faltan 3 entrenamientos para cumplir la semana. ¡Hoy toca Torso A!');
    expect(dailyCheer([done('2026-10-29T09:00:00')], 4, 'Torso A', now)).toMatchObject({ pose: 'party', text: '¡Hoy ya entrenaste! 1 de 4 esta semana. Mañana, a por más.' });
    expect(dailyCheer(['26', '27', '28'].map(d => done(`2026-10-${d}T10:00:00`)), 3, 'Torso A', now).pose).toBe('party');
    expect(dailyCheer([done('2026-10-20T10:00:00')], 4, 'Torso A', now)).toMatchObject({ pose: 'sad', text: expect.stringContaining('Hace 9 días que no entrenas') });
  });
  it('resumen de la semana al terminar', () => {
    expect(weekCheer(2, 4)).toBe('Llevas 2 de 4 esta semana. Te faltan 2 entrenamientos para cumplirla.');
    expect(weekCheer(4, 4)).toBe('¡Semana cumplida! 4 de 4 entrenamientos.');
  });
});

describe('ejercicios asistidos: el peso es la ayuda, menos es mejor', () => {
  const pull = ex({ key: 'assisted_pullup', name: 'Dominadas asistidas', load: 'bloques', weightStep: 1, assisted: true, reps: { min: 6, max: 10 }, sets: 3, rir: '2' });

  it('progresar es bajar la ayuda y retroceder, subirla', () => {
    expect(suggest(pull, sets(10, [10, 10, 10], 2), normalProg)).toMatchObject({ level: 'up', action: 'Baja a 9 bloques de asistencia.', weight: 9 });
    expect(suggest(pull, sets(10, [5, 5, 4], 1), normalProg)).toMatchObject({ level: 'down', action: 'Sube a 11 bloques de asistencia.', weight: 11 });
    expect(suggest(pull, sets(0, [8, 7, 6], 2), normalProg)).toMatchObject({ level: 'up', action: 'Ya lo haces sin asistencia.' });
    // Con series de distinta ayuda, la referencia es la menor
    expect(suggest(pull, [{ set_index: 0, weight: 12, reps: 10, rir: 2 }, { set_index: 1, weight: 10, reps: 10, rir: 2 }, { set_index: 2, weight: 10, reps: 10, rir: 2 }], normalProg).weight).toBe(9);
  });

  it('14 bloques de ayuda es peor que 10: récord, Rocky y texto', () => {
    expect(recordFor(pull, { weight: 9, reps: 6 }, [{ weight: 10, reps: 8 }])?.text).toBe('Nuevo récord: solo 9 bloques de asistencia');
    expect(recordFor(pull, { weight: 14, reps: 9 }, [{ weight: 10, reps: 8 }, { weight: 14, reps: 10 }])).toBeNull();
    expect(recordFor(pull, { weight: 10, reps: 9 }, [{ weight: 10, reps: 8 }, { weight: 14, reps: 10 }])?.kind).toBe('reps');
    expect(compareSet(pull, { weight: 10, reps: 8 }, { weight: 14, reps: 8 })).toBe('win');
    expect(compareSet(pull, { weight: 14, reps: 8 }, { weight: 10, reps: 8 })).toBe('lose');
    expect(setText(pull, { weight: 10, reps: 8, rir: null })).toBe('10 bloques de asistencia × 8');
  });

  it('descarga con más ayuda y sin contar en el volumen', () => {
    expect(deloadWeight(pull, 10)).toBe(11);
    expect(deloadWeight(pull, 0)).toBe(1);
    const prog = { ...P, id: 'own:a', days: [{ id: 'D1', name: 'Día 1', focus: '', color: 'red' as const, exercises: [pull, findExercise(P, 'squat_bar')!] }] };
    const w = { ...wk('w1', '2026-10-28T10:00:00Z', '2026-10-28T11:00:00Z'), program_id: prog.id, day_id: 'D1' };
    const d = data([w], [st('w1', '', 0, 10, 8, 'assisted_pullup'), st('w1', '', 0, 50, 10, 'squat_bar')]);
    expect(workoutSummary(d, w, id => (id === prog.id ? prog : undefined)).volume).toBe(500);
  });

  it('se reconoce por el nombre al importar y en la alternativa', () => {
    const res = importRoutine([{ name: 'h', rows: [['ejercicio', 'series', 'reps'], ['Dominadas asistidas', '3', '6-10'], ['Remo con barra', '3', '8']] }]);
    expect(res.program!.days[0].exercises.map(e => !!e.assisted)).toEqual([true, false]);
    expect(altExercise(findExercise(P, 'pullup')!).assisted).toBe(true);
    expect(altExercise(findExercise(P, 'squat_bar')!).assisted).toBeUndefined();
  });
});
