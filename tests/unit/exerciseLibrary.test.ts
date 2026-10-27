import { describe, expect, it } from 'vitest';
import { validateProgram } from '../../src/domain/customProgram';
import { libraryFor, loadLibrary } from '../../src/domain/exerciseLibrary';
import { generatedRoutine, generateRequest, type GenerateAnswers } from '../../src/domain/routineGenerate';
import type { AiRoutine } from '../../src/domain/routineImport';

const answers = (place: string): GenerateAnswers => ({
  age: 40, sex: 'Mujer', goals: ['Mejorar postura y movilidad'], level: 'Empiezo', days: 2, minutes: 45, place, limitations: '', preferences: ''
});

const row = (exercise: string, ref = '', reps = '10-12'): AiRoutine['rows'][number] =>
  ({ day: 'Día A', exercise, sets: '3', reps, rir: '2', rest: '60', group: '', notes: '', weight: '', video: '', ref, uncertain: false });

describe('catálogo de ExerciseDB', () => {
  it('se carga con nombres únicos, en inglés, e instrucciones en español', async () => {
    const items = await loadLibrary();
    expect(items.length).toBeGreaterThan(1200);
    expect(new Set(items.map(i => i.name)).size).toBe(items.length);
    const plank = items.find(i => i.name === 'front plank with twist');
    expect(plank?.eq).toBe('body weight');
    expect(plank?.steps.join(' ')).toMatch(/plancha|antebrazos|codos/i);
  });

  it('filtra por lugar: sin material solo peso corporal; con mancuernas, también bandas', async () => {
    const items = await loadLibrary();
    const bare = libraryFor('Casa sin material', items);
    expect(bare.length).toBeGreaterThan(200);
    expect(new Set(bare.map(i => i.eq))).toEqual(new Set(['body weight']));
    const home = new Set(libraryFor('Casa con mancuernas', items).map(i => i.eq));
    expect(home).toEqual(new Set(['body weight', 'dumbbell', 'band', 'resistance band']));
    expect(libraryFor('Gimnasio completo', items)).toHaveLength(items.length);
    expect(generateRequest(answers('Casa sin material'), items).library).toEqual(bare.map(i => i.name));
  });

  it('la rutina con IA usa el ejercicio del catálogo citado en ref, con su nombre en español', async () => {
    const items = await loadLibrary();
    const ai: AiRoutine = {
      name: 'Movilidad', description: '', precautions: [], warnings: [],
      rows: [row('Sentadilla con barra'), row('Plancha con giro', 'front plank with twist', '30s'), row('Ejercicio inventado'), row('Plancha rara', 'no existe')]
    };
    const res = generatedRoutine(ai, answers('Gimnasio completo'), items);
    const ex = res.program!.days[0].exercises;
    const plank = ex.find(e => e.name === 'Plancha con giro')!;
    expect(plank.key).toMatch(/^edb_/);
    expect(plank.unit).toBe('s');
    expect(plank.muscle).toBe('Abdominales');
    expect(plank.instructions?.length).toBeGreaterThan(0);
    expect(plank.noWeight).toBe(true);
    expect(plank.gifUrl).toBeUndefined();
    expect(plank.exercisedbId).toBeUndefined();
    // Reconocido: no se marca para revisar; los inventados y un ref que no existe, sí
    expect(res.review).not.toContain(plank.key);
    expect(res.review).toContain(ex.find(e => e.name === 'Ejercicio inventado')!.key);
    expect(ex.find(e => e.name === 'Plancha rara')!.key).toMatch(/^own_/);
    expect(res.notes.join(' ')).toContain('1 ejercicio sale del catálogo de ExerciseDB');
    expect(validateProgram(res.program!)).toEqual([]);
  });
});
