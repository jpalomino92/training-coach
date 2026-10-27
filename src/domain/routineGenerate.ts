/* ==========================================================
   Rutina a medida con IA: las respuestas de la persona (en el perfil
   inicial o desde "Cambiar de rutina") van a la Edge Function, que
   devuelve filas como una rutina importada. Se convierten con el mismo
   importador y se revisan en el editor antes de guardarla.
   ========================================================== */
import type { AiGenerateInput } from '../services/aiImport';
import { libraryFor, libraryMatches, type LibraryItem } from './exerciseLibrary';
import { catalogNames, importAiRoutine, type AiRoutine, type RoutineImport } from './routineImport';

export const GOAL_OPTIONS = ['Perder grasa', 'Ganar fuerza', 'Ganar músculo', 'Mejorar postura y movilidad', 'Mantenerme activa o activo'];
/** Objetivos guardados en el perfil ("Ganar fuerza, Ganar músculo") → lista. */
export const goalsOf = (goal: string | undefined) => (goal || '').split(',').map(g => g.trim()).filter(g => GOAL_OPTIONS.includes(g));

export const DAYS_OPTIONS = [2, 3, 4, 5, 6];
export const MINUTES_OPTIONS = [30, 45, 60, 75, 90];
export const PLACE_OPTIONS = ['Gimnasio completo', 'Gimnasio pequeño', 'Casa con mancuernas', 'Casa sin material'];

export interface GenerateAnswers {
  age: number | null;
  sex: string;
  goals: string[];
  level: string;
  days: number;
  minutes: number;
  place: string;
  limitations: string;
  preferences: string;
}

export const AI_NOTICE = 'Esta rutina la creó una IA con tus respuestas: no sustituye el consejo de un profesional. Si algo te duele, para y consúltalo.';

/**
 * Lo que se envía a la IA: las respuestas, los ejercicios de la app (comparten historial y dibujo)
 * y los del catálogo de ExerciseDB que se pueden hacer en ese lugar.
 */
export const generateRequest = (a: GenerateAnswers, library: LibraryItem[] = []): AiGenerateInput => ({
  ...a, limitations: a.limitations.trim(), preferences: a.preferences.trim(), catalog: catalogNames(),
  library: libraryFor(a.place, library).map(i => i.name)
});

/** Las respuestas como texto, para "Ver lo que le pediste a la IA". */
export function answersText(a: GenerateAnswers): string {
  return [
    ['Objetivos', a.goals.join(', ') || 'Sin elegir'],
    ['Nivel', a.level || 'Sin elegir'],
    ['Edad', a.age == null ? '' : String(a.age)],
    ['Sexo', a.sex],
    ['Días por semana', String(a.days)],
    ['Minutos por sesión', String(a.minutes)],
    ['Dónde entrenas', a.place],
    ['Lesiones o limitaciones', a.limitations.trim() || 'Ninguna'],
    ['Preferencias', a.preferences.trim()]
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
}

/** Rutina creada por la IA, lista para revisar: aviso de IA, precauciones y progresión prudente si hace falta. */
export function generatedRoutine(ai: AiRoutine, a: GenerateAnswers, library: LibraryItem[] = []): RoutineImport {
  const extra = libraryMatches(ai.rows, library);
  const res = importAiRoutine(ai, { kind: 'generated', name: 'Rutina a tu medida', text: answersText(a) }, extra);
  const p = res.program;
  if (!p) return res;
  const hurt = !!a.limitations.trim();
  const warnings = [AI_NOTICE, ...p.safety.warnings];
  // Con lesiones o limitaciones hay que aceptar las precauciones antes de entrenar (se pide en Hoy)
  p.safety = hurt
    ? { requiresHealthNotice: true, warnings, ackText: 'He leído las precauciones y entreno bajo mi responsabilidad.', rules: [] }
    : { requiresHealthNotice: false, warnings, rules: [] };
  p.progression.cautious = hurt || (a.age ?? 0) >= 60;
  p.level = a.level;
  p.audience = a.goals.join(', ').slice(0, 60);
  const fromLibrary = extra.size ? p.days.reduce((n, d) => n + d.exercises.filter(e => e.key.startsWith('edb_')).length, 0) : 0;
  if (p.description === 'Importada con IA.') p.description = 'Creada con IA a partir de tus respuestas.';
  res.notes = [
    'La creó la IA con tus respuestas: revisa los ejercicios, las series y los descansos antes de guardarla. La primera vez elige pesos con los que te sobren repeticiones.',
    ...(fromLibrary ? [`${fromLibrary === 1 ? '1 ejercicio sale' : `${fromLibrary} ejercicios salen`} del catálogo de ExerciseDB: traen sus músculos y el paso a paso en "Técnica".`] : []),
    ...res.notes
  ];
  return res;
}
