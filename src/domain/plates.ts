/* Calculadora de discos: qué poner a cada lado de la barra. */
import { fmtNum } from './format';

/** Ejercicios de la rutina que se hacen con barra libre. */
export const BARBELL_KEYS = new Set(['squat_bar', 'rdl_bar', 'bench_press', 'row_bar', 'hip_thrust', 'deadlift']);

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BAR_OPTIONS = [20, 15, 10] as const;

export interface PlateResult {
  /** Discos por lado, de mayor a menor. */
  perSide: number[];
  /** Kg que no se pueden cargar exactos con los discos disponibles (total, no por lado). */
  remainder: number;
  /** El peso es menor que la barra sola. */
  belowBar: boolean;
}

/** "Por lado: 20 + 10 + 1,25 (barra de 20 kg)" */
export function platesText(total: number | null, bar: number): string {
  if (total == null || !(total > 0)) return '';
  const r = platesFor(total, bar);
  if (r.belowBar) return `Menos que la barra sola (${fmtNum(bar)} kg).`;
  if (!r.perSide.length) return `Solo la barra (${fmtNum(bar)} kg).`;
  const base = `Por lado: ${r.perSide.map(fmtNum).join(' + ')} (barra de ${fmtNum(bar)} kg)`;
  return r.remainder > 0 ? `${base}; no se llega exacto, faltan ${fmtNum(r.remainder)} kg.` : `${base}.`;
}

export function platesFor(total: number, bar = 20, plates = PLATES): PlateResult {
  if (!(total > 0) || total < bar) return { perSide: [], remainder: 0, belowBar: total > 0 && total < bar };
  let side = Math.round(((total - bar) / 2) * 100) / 100;
  const perSide: number[] = [];
  for (const p of plates) {
    while (side + 1e-9 >= p) { perSide.push(p); side = Math.round((side - p) * 100) / 100; }
  }
  return { perSide, remainder: Math.round(side * 2 * 100) / 100, belowBar: false };
}
