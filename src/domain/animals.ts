/* ==========================================================
   "Levantaste 2 morsas": compara el peso total levantado en un
   entrenamiento con el peso medio de un animal.
   Pesos medios aproximados de un ejemplar adulto.
   ========================================================== */
import { fmtNum } from './format';

export interface Animal {
  id: 'gato' | 'perro' | 'oveja' | 'leon' | 'oso' | 'morsa' | 'rinoceronte' | 'elefante' | 'ballena';
  one: string;
  many: string;
  /** "Un" o "Una", para "Una morsa pesa…". */
  article: 'Un' | 'Una';
  kg: number;
}

/** De menor a mayor peso. */
export const ANIMALS: Animal[] = [
  { id: 'gato', one: 'gato', many: 'gatos', article: 'Un', kg: 4 },
  { id: 'perro', one: 'perro', many: 'perros', article: 'Un', kg: 30 },
  { id: 'oveja', one: 'oveja', many: 'ovejas', article: 'Una', kg: 70 },
  { id: 'leon', one: 'león', many: 'leones', article: 'Un', kg: 190 },
  { id: 'oso', one: 'oso pardo', many: 'osos pardos', article: 'Un', kg: 400 },
  { id: 'morsa', one: 'morsa', many: 'morsas', article: 'Una', kg: 1000 },
  { id: 'rinoceronte', one: 'rinoceronte', many: 'rinocerontes', article: 'Un', kg: 2300 },
  { id: 'elefante', one: 'elefante', many: 'elefantes', article: 'Un', kg: 6000 },
  { id: 'ballena', one: 'ballena jorobada', many: 'ballenas jorobadas', article: 'Una', kg: 30000 }
];

export interface AnimalMatch { animal: Animal; count: number; text: string }

/**
 * El animal más pesado que cabe al menos dos veces ("2 morsas" se lee mejor que "1,2 rinocerontes");
 * si no cabe dos veces ninguno, el que cabe una. null si no llega ni a un gato.
 */
export function animalFor(kg: number): AnimalMatch | null {
  const desc = [...ANIMALS].reverse();
  const animal = desc.find(a => a.kg * 2 <= kg) || desc.find(a => a.kg <= kg);
  if (!animal) return null;
  const count = Math.floor(kg / animal.kg);
  return { animal, count, text: `${fmtNum(count)} ${count === 1 ? animal.one : animal.many}` };
}
