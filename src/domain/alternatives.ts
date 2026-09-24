/* ==========================================================
   Alternativa del día ("la máquina está ocupada").
   Las series de la alternativa se guardan con la clave del ejercicio
   más el sufijo __alt: tienen su propio historial, su propia
   sugerencia y no se mezclan con los pesos del ejercicio original.
   El ejercicio alternativo se deriva de los datos de la rutina
   (su campo `alt`); no se añade contenido nuevo a la rutina.
   ========================================================== */
import { findExercise, findExerciseAnywhere } from './routines';
import type { Exercise, Program } from './types';

export const ALT_SUFFIX = '__alt';
export const altKey = (key: string) => (key.endsWith(ALT_SUFFIX) ? key : key + ALT_SUFFIX);
export const isAltKey = (key: string) => key.endsWith(ALT_SUFFIX);
export const baseKey = (key: string) => (isAltKey(key) ? key.slice(0, -ALT_SUFFIX.length) : key);

/** El ejercicio alternativo: mismo esquema de series, descanso y paso de peso. */
export function altExercise(ex: Exercise): Exercise {
  return {
    ...ex,
    key: altKey(ex.key),
    name: ex.alt,
    alt: ex.name,
    // La técnica y la precaución son del ejercicio original: no se trasladan
    cue: '',
    warn: ''
  };
}

/** Resuelve una clave de serie (normal o __alt) al ejercicio correspondiente. */
export function resolveExercise(program: Program | undefined, key: string): Exercise | null {
  const base = (program && findExercise(program, baseKey(key))) || findExerciseAnywhere(baseKey(key));
  if (!base) return null;
  return isAltKey(key) ? altExercise(base) : base;
}
