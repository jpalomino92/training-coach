/* ==========================================================
   Sistema de 2 series (Boulder Shoulders Bible):
   serie 1 pesada al fallo; serie 2 con un 30–40 % menos de peso
   y una técnica para ir más allá del fallo.
   ========================================================== */
import { round2 } from './format';
import type { Exercise, SetTechnique } from './types';

export const TECHNIQUES: Record<SetTechnique, { name: string; how: string }> = {
  drop: {
    name: 'drop set',
    how: 'Llega al fallo, quita al momento un 20–30 % del peso y sigue hasta el fallo otra vez. Repite si quieres.'
  },
  myo: {
    name: 'myo-reps',
    how: 'Llega casi al fallo, respira 15–20 segundos y haz mini series de 3–5 repeticiones con el mismo peso hasta que no salgan.'
  },
  restpause: {
    name: 'rest-pause',
    how: 'Llega al fallo, descansa 15–20 segundos y saca más repeticiones con el mismo peso. Repítelo una o dos veces.'
  }
};

/** Peso orientativo de la serie 2: un 35 % menos que la serie 1, redondeado al paso del ejercicio. */
export function secondSetWeight(ex: Pick<Exercise, 'weightStep'>, topWeight: number): number {
  const step = ex.weightStep || 1;
  return Math.max(0, round2(Math.round((topWeight * 0.65) / step) * step));
}

/** Indicación de cada serie en el formulario: qué hacer en la serie 1 y en la 2. */
export function setNote(ex: Exercise, index: number): string | undefined {
  if (!ex.setTechnique) return undefined;
  if (index === 0) return `Serie tope: al fallo entre ${ex.reps.min} y ${ex.reps.max} repeticiones, sin balanceo.`;
  const t = TECHNIQUES[ex.setTechnique];
  return `Baja el peso un 30–40 % y haz ${t.name}. Anota el peso con el que empiezas y el total de repeticiones.`;
}
