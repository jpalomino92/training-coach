/* ==========================================================
   Cardio final: un bloque al final de cada día en el que se
   encadenan máquinas (5 min de escaladora, 10 de bicicleta…).
   Cada tramo se guarda como una serie de la máquina elegida
   (su propia clave), así cada máquina tiene su historial.
   Se añade al cargar la rutina: no hace falta editar ninguna.
   ========================================================== */
import type { Exercise, Program, WorkoutSet } from './types';

export const CARDIO_SLOT_KEY = 'cardio_final';

const base = { sets: 1, unit: 'min' as const, rir: '', rest: 60, cue: '', alt: '', perSide: false, warn: '', compound: false, weightStep: 1, noWeight: true, muscle: 'Cardio' };

export const CARDIO_MACHINES: Exercise[] = [
  { ...base, key: 'cardio_treadmill', name: 'Cinta', pose: 'farmer', reps: { min: 1, max: 60 } },
  { ...base, key: 'cardio_bike', name: 'Bicicleta', pose: 'legext', reps: { min: 1, max: 60 } },
  { ...base, key: 'cardio_stairs', name: 'Escaladora', pose: 'stepup', reps: { min: 1, max: 60 } },
  { ...base, key: 'cardio_elliptical', name: 'Elíptica', pose: 'lunge', reps: { min: 1, max: 60 } },
  { ...base, key: 'cardio_rower', name: 'Remo', pose: 'cablerow', reps: { min: 1, max: 60 } }
];

export const isCardioMachineKey = (key: string) => CARDIO_MACHINES.some(m => m.key === key);
export const cardioMachine = (key: string) => CARDIO_MACHINES.find(m => m.key === key) || null;

export const CARDIO_SLOT: Exercise = {
  ...base, key: CARDIO_SLOT_KEY, name: 'Cardio final', pose: 'farmer', reps: { min: 5, max: 20 }, cardioSlot: true,
  cue: 'Elige la máquina y los minutos. Puedes encadenar varias, por ejemplo 5 min de escaladora, 10 de bicicleta y 6 de cinta. A un ritmo que puedas mantener.'
};

/** Tramos de cardio registrados hoy, en orden. */
export const cardioSegments = (sets: WorkoutSet[]) => sets.filter(s => isCardioMachineKey(s.exercise_key)).sort((a, b) => a.set_index - b.set_index);

const cache = new WeakMap<Program, Program>();

/** La rutina con el cardio final al final de cada día (salvo las que lo desactivan). */
export function withCardio(p: Program): Program {
  if (p.cardioFinisher === false) return p;
  let out = cache.get(p);
  if (!out) {
    out = { ...p, days: p.days.map(d => (d.exercises.some(e => e.cardioSlot) ? d : { ...d, exercises: [...d.exercises, CARDIO_SLOT] })) };
    cache.set(p, out);
  }
  return out;
}

/** Series que cuentan para el día: el cardio final cuenta como una aunque tenga varios tramos. */
export const countedSets = (sets: WorkoutSet[]) => sets.filter(s => !isCardioMachineKey(s.exercise_key)).length + (sets.some(s => isCardioMachineKey(s.exercise_key)) ? 1 : 0);
