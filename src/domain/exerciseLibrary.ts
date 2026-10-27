/* ==========================================================
   Catálogo de ejercicios de ExerciseDB (solo texto, en src/data,
   generado con scripts/exercise-catalog.mjs). La rutina con IA puede
   elegir de aquí lo que no está en las rutinas incluidas (movilidad,
   core, peso corporal, bandas…): la IA escribe el nombre en español y,
   en `ref`, el nombre exacto del catálogo, y el ejercicio llega con sus
   músculos e instrucciones en español. Sin GIF: usa el dibujo según el
   músculo. Se carga aparte (pesa ~900 KB) y solo al crear una rutina.
   ========================================================== */
import { exerciseFromDb } from './customProgram';
import { canon } from './routineImport';
import type { Exercise } from './types';

export interface LibraryItem {
  /** Id de ExerciseDB (el mismo que usa la búsqueda del editor). */
  id: string;
  /** Nombre en inglés, en minúsculas. */
  name: string;
  eq: string;
  part: string;
  target: string;
  sec: string[];
  /** Instrucciones en español. */
  steps: string[];
}

let loaded: Promise<LibraryItem[]> | null = null;

/** El catálogo completo; si no se puede cargar (sin conexión), lista vacía. */
export function loadLibrary(): Promise<LibraryItem[]> {
  loaded ??= import('../data/exercise-catalog.json')
    .then(m => (m.default as { items: LibraryItem[] }).items)
    .catch(() => { loaded = null; return []; });
  return loaded;
}

const HOME_BARE = new Set(['body weight']);
const HOME_DUMBBELLS = new Set(['body weight', 'dumbbell', 'band', 'resistance band']);
const NOT_SMALL_GYM = new Set(['smith machine', 'sled machine', 'olympic barbell', 'trap bar', 'bosu ball']);

/** Lo que se puede hacer en ese lugar (ver PLACE_OPTIONS). */
export function libraryFor(place: string, items: LibraryItem[]): LibraryItem[] {
  if (place === 'Casa sin material') return items.filter(i => HOME_BARE.has(i.eq));
  if (place === 'Casa con mancuernas') return items.filter(i => HOME_DUMBBELLS.has(i.eq));
  if (place === 'Gimnasio pequeño') return items.filter(i => !NOT_SMALL_GYM.has(i.eq));
  return items;
}

/** Ejercicio de la app a partir de una entrada del catálogo, con el nombre en español que eligió la IA. */
export function libraryExercise(item: LibraryItem, name: string): Exercise {
  const ex = exerciseFromDb({
    exerciseId: item.id, name: item.name, gifUrl: '', bodyParts: [item.part], equipments: [item.eq],
    targetMuscles: [item.target], secondaryMuscles: item.sec, instructions: item.steps
  });
  // Sin animación (las de ExerciseDB tienen licencia aparte) ni marca de "nombre en inglés"
  delete ex.gifUrl;
  delete ex.exercisedbId;
  return { ...ex, name, noWeight: item.eq === 'body weight' ? true : undefined };
}

/** Nombre en español → ejercicio, para las filas de la IA que citan el catálogo en `ref`. */
export function libraryMatches(rows: { exercise: string; ref?: string }[], items: LibraryItem[]): Map<string, Exercise> {
  const byName = new Map(items.map(i => [i.name, i]));
  const out = new Map<string, Exercise>();
  for (const r of rows) {
    const item = r.ref ? byName.get(r.ref.trim().toLowerCase()) : undefined;
    const name = r.exercise.replace(/\s+/g, ' ').trim();
    if (item && name && !out.has(canon(name))) out.set(canon(name), libraryExercise(item, name));
  }
  return out;
}
