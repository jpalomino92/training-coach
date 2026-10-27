/* ==========================================================
   Series de calentamiento para los básicos con carga.
   Escalera calculada sobre el peso de trabajo de la serie 1.
   Solo en el primer básico de cada músculo del día: después ese
   músculo ya está caliente (p. ej. la prensa tras la sentadilla).
   No se registran: no cuentan para el historial ni el volumen.
   ========================================================== */
import { norm } from './csv';
import { isTimed, round2 } from './format';
import type { Exercise } from './types';

export interface WarmupSet {
  weight: number;
  reps: number;
  /** Solo la barra, sin discos. */
  barOnly?: boolean;
}

/** Con barra: barra sola × 10, 50 % × 5, 70 % × 3, 85 % × 1. */
const BAR_STEPS: [number, number][] = [[0.5, 5], [0.7, 3], [0.85, 1]];
/** Mancuernas y máquinas: 50 % × 8, 75 % × 4. */
const OTHER_STEPS: [number, number][] = [[0.5, 8], [0.75, 4]];

/** Lleva calentamiento: básico con carga, que no sea por tiempo ni asistido. */
export const needsWarmup = (ex: Exercise) => ex.compound && !ex.noWeight && !ex.assisted && !isTimed(ex) && !ex.cardioSlot;

/** Músculo principal comparable: "Cuádriceps y glúteo" → "cuadricep". */
const mainMuscle = (ex: Pick<Exercise, 'muscle'>) => norm(ex.muscle || '').split(' ')[0].replace(/s$/, '');

/** Antes, en el día, hay otro básico con calentamiento del mismo músculo principal. */
export function warmedUpBefore(dayExercises: Exercise[], ex: Exercise): boolean {
  const m = mainMuscle(ex);
  if (!m) return false;
  const i = dayExercises.findIndex(e => e.key === ex.key);
  return dayExercises.slice(0, i < 0 ? 0 : i).some(e => needsWarmup(e) && mainMuscle(e) === m);
}

/**
 * Escalera de calentamiento hasta el peso de trabajo.
 * @param barKg peso de la barra si el ejercicio es con barra libre
 */
export function warmupSets(ex: Pick<Exercise, 'weightStep'>, work: number, barKg?: number): WarmupSet[] {
  if (!(work > 0)) return [];
  const step = ex.weightStep || 1;
  const round = (w: number) => round2(Math.round(w / step) * step);
  const out: WarmupSet[] = [];
  if (barKg != null) {
    if (work <= barKg) return [];
    out.push({ weight: barKg, reps: 10, barOnly: true });
  }
  for (const [pct, reps] of barKg != null ? BAR_STEPS : OTHER_STEPS) {
    const w = round(work * pct);
    const prev = out[out.length - 1]?.weight ?? 0;
    // Solo pasos que suben y quedan por debajo del peso de trabajo
    if (w > prev && w < work) out.push({ weight: w, reps });
  }
  return out;
}
