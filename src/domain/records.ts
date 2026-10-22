/* Récords personales: una serie supera todo lo registrado antes en ese ejercicio. */
import { isTimed, loadText, unitSuffix } from './format';
import type { Exercise, WorkoutSet } from './types';

export interface RecordHit {
  /** weight: más peso que nunca. reps: más repeticiones que nunca con ese peso o más. time: más segundos. */
  kind: 'weight' | 'reps' | 'time';
  text: string;
}

type SetLike = Pick<WorkoutSet, 'weight' | 'reps'> & { id?: string };

/**
 * @param set      la serie recién registrada
 * @param previous el resto de series de ese ejercicio (de cualquier sesión, sin incluir esta)
 * Sin historial previo no hay récord: la primera vez no se compara con nada.
 */
export function recordFor(ex: Pick<Exercise, 'unit' | 'load'>, set: SetLike, previous: SetLike[]): RecordHit | null {
  const prev = previous.filter(p => p.id === undefined || p.id !== set.id);
  if (!prev.length) return null;
  const w = set.weight || 0;
  if (isTimed(ex)) {
    return set.reps > Math.max(...prev.map(p => p.reps)) ? { kind: 'time', text: `Nuevo récord: ${set.reps}${unitSuffix(ex)}` } : null;
  }
  const maxW = Math.max(...prev.map(p => p.weight || 0));
  if (w > 0 && w > maxW) return { kind: 'weight', text: `Nuevo récord de peso: ${loadText(w, ex)}` };
  const comparable = prev.filter(p => (p.weight || 0) >= w);
  if (comparable.length && set.reps > Math.max(...comparable.map(p => p.reps))) {
    return { kind: 'reps', text: w > 0 ? `Nuevo récord: ${set.reps} repeticiones con ${loadText(w, ex)}` : `Nuevo récord: ${set.reps} repeticiones` };
  }
  return null;
}

/** Ids de las series que fueron récord en su momento (en orden cronológico). */
export function recordSetIds(ex: Pick<Exercise, 'unit' | 'load'>, setsInOrder: WorkoutSet[]): Set<string> {
  const out = new Set<string>();
  const seen: WorkoutSet[] = [];
  for (const s of setsInOrder) {
    if (recordFor(ex, s, seen)) out.add(s.id);
    seen.push(s);
  }
  return out;
}
