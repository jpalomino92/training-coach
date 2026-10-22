/* ==========================================================
   Biseries y circuitos: ejercicios seguidos que se hacen
   alternando series (A1 → B1 → descanso → A2 → B2 …).
   Vienen de la rutina (campo `group`) o los elige la persona
   (prefs.supersets, por rutina y día). Las dos cosas se pueden
   deshacer y la elección se mantiene las semanas siguientes.
   ========================================================== */
import { altKey } from './alternatives';
import type { Exercise, Prefs, SupersetPrefs, WorkoutDay, WorkoutSet } from './types';

export interface DayUnit {
  exercises: Exercise[];
  /** 'routine': grupo de la rutina. 'user': biserie elegida por la persona. null: ejercicio normal. */
  source: 'routine' | 'user' | null;
  /** Grupo de la rutina al que pertenece (aunque se haga por separado). */
  group?: string;
}

export const supersetKey = (programId: string, dayId: string) => `${programId}:${dayId}`;
export const supersetPrefsFor = (prefs: Prefs, programId: string, dayId: string): SupersetPrefs =>
  prefs.supersets?.[supersetKey(programId, dayId)] || {};

export const isGroup = (u: DayUnit) => u.exercises.length > 1;
export const unitLabel = (u: DayUnit) => (u.exercises.length > 2 ? 'Circuito' : 'Biserie');
export const unitRounds = (u: DayUnit) => Math.max(...u.exercises.map(e => e.sets));

/** El día agrupado en bloques: ejercicios sueltos, biseries y circuitos, en el orden de la rutina. */
export function dayUnits(day: WorkoutDay, sp: SupersetPrefs = {}): DayUnit[] {
  const split = new Set(sp.split || []);
  const units: DayUnit[] = [];
  for (const ex of day.exercises) {
    const prev = units[units.length - 1];
    const group = ex.group && !split.has(ex.group) ? ex.group : undefined;
    if (group && prev?.source === 'routine' && prev.group === group) prev.exercises.push(ex);
    else units.push({ exercises: [ex], source: group ? 'routine' : null, group });
  }
  // Un grupo de un solo ejercicio es un ejercicio normal
  for (const u of units) if (u.exercises.length === 1 && u.source === 'routine') { u.source = null; u.group = undefined; }
  for (const [a, b] of sp.pairs || []) {
    const i = units.findIndex(u => !isGroup(u) && u.exercises[0].key === a);
    const next = units[i + 1];
    if (i < 0 || !next || isGroup(next) || next.exercises[0].key !== b) continue;
    units.splice(i, 2, { exercises: [units[i].exercises[0], next.exercises[0]], source: 'user' });
  }
  return units;
}

/** Ni el cardio ni los básicos pesados (descanso largo) se hacen en biserie. */
const pairable = (e: Exercise) => e.unit !== 'min' && !(e.compound && e.rest >= 150) && !e.group;

/** Se puede hacer en biserie con el ejercicio siguiente si los dos van sueltos. */
export function canPair(a: DayUnit, b: DayUnit | undefined): b is DayUnit {
  return !!b && !isGroup(a) && !isGroup(b) && pairable(a.exercises[0]) && pairable(b.exercises[0]);
}

export function withPair(sp: SupersetPrefs, a: string, b: string): SupersetPrefs {
  const pairs = (sp.pairs || []).filter(([x, y]) => ![a, b].includes(x) && ![a, b].includes(y));
  return { ...sp, pairs: [...pairs, [a, b]] };
}

/** Vuelve a modo normal: deshace la biserie elegida o separa el grupo de la rutina. */
export function withoutUnit(sp: SupersetPrefs, u: DayUnit): SupersetPrefs {
  if (u.source === 'user') {
    const keys = u.exercises.map(e => e.key);
    return { ...sp, pairs: (sp.pairs || []).filter(([x]) => !keys.includes(x)) };
  }
  if (u.source === 'routine' && u.group) return { ...sp, split: [...new Set([...(sp.split || []), u.group])] };
  return sp;
}

/** Vuelve a hacer el grupo de la rutina como biserie o circuito. */
export const withGroup = (sp: SupersetPrefs, group: string): SupersetPrefs => ({ ...sp, split: (sp.split || []).filter(g => g !== group) });

/** Series registradas de un ejercicio (con el ejercicio o con su alternativa). */
export const doneIndexes = (sets: WorkoutSet[], ex: Exercise) =>
  new Set(sets.filter(s => s.exercise_key === ex.key || s.exercise_key === altKey(ex.key)).map(s => s.set_index));

/** La serie que toca: vuelta a vuelta y, dentro de cada vuelta, en el orden de la rutina. */
export function nextTurn(exs: Exercise[], sets: WorkoutSet[]): { ex: Exercise; set: number } | null {
  const done = exs.map(e => doneIndexes(sets, e));
  const rounds = Math.max(...exs.map(e => e.sets));
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < exs.length; k++) if (r < exs[k].sets && !done[k].has(r)) return { ex: exs[k], set: r };
  }
  return null;
}
