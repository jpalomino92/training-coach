/* Formato de números, fechas y textos derivados de los datos de la rutina. */
import type { Exercise } from './types';

export const DAY_MS = 86_400_000;

/** Número con coma decimal y sin ceros sobrantes: 42.5 → "42,5". */
export const fmtNum = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? '—' : String(Math.round(v * 100) / 100).replace('.', ',');

/** Acepta coma o punto. '' → null; texto no numérico → NaN. */
export function parseNum(v: string | number | null | undefined): number | null {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).trim().replace(',', '.'));
  return Number.isNaN(n) ? NaN : n;
}

export const round2 = (v: number) => Math.round(v * 100) / 100;

const pad = (n: number) => String(n).padStart(2, '0');

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = toDate(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const fmtDayMonth = (iso: string): string => {
  const d = toDate(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "Lun 22/09" */
export const fmtWeekdayShort = (iso: string) => `${WEEKDAYS_SHORT[toDate(iso).getDay()]} ${fmtDayMonth(iso)}`;
/** "miércoles 23/09" */
export const fmtWeekdayLong = (iso: string) => `${WEEKDAYS[toDate(iso).getDay()]} ${fmtDayMonth(iso)}`;
/** "Miércoles 23 sept" (cabecera de Hoy) */
export const fmtToday = (d: Date) => {
  const w = WEEKDAYS[d.getDay()];
  return `${w[0].toUpperCase()}${w.slice(1)} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
/** "4 ago" */
export const fmtDayMonthShort = (iso: string) => { const d = toDate(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
/** "Septiembre 2026" */
export const fmtMonthYear = (iso: string) => { const d = toDate(iso); const m = MONTHS[d.getMonth()]; return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}`; };

/** Fecha local YYYY-MM-DD. */
export const localDate = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Interpreta 'YYYY-MM-DD' como fecha local (no UTC). */
export function toDate(iso: string | Date): Date {
  if (iso instanceof Date) return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

export const sameDay = (a: string | number | Date, b: string | number | Date) => {
  const x = typeof a === 'string' ? toDate(a) : new Date(a);
  const y = typeof b === 'string' ? toDate(b) : new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

export const restText = (s: number) => (s <= 120 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`);
export const rangeText = (ex: Exercise) => `${ex.reps.min}${ex.reps.max !== ex.reps.min ? '-' + ex.reps.max : ''}${ex.unit === 's' ? ' s' : ''}`;
export const targetText = (ex: Exercise) => `${ex.sets} × ${rangeText(ex)}${ex.perSide ? ' por lado' : ''}`;
export const repLabel = (ex: Exercise) => (ex.unit === 's' ? 'Seg' : 'Reps');
/** Primer valor del RIR objetivo: '2-3' → '2'. */
export const rirFirst = (ex: Exercise) => String(ex.rir).split('-')[0];

export const kg = (v: number) => `${fmtNum(v)} kg`;

/** "40 kg" o "40–42,5 kg" si el peso cambió entre series. */
export function weightRange(weights: number[]): string {
  const w = weights.filter(x => x > 0);
  if (!w.length) return 'Sin carga';
  const mn = Math.min(...w), mx = Math.max(...w);
  return mn === mx ? kg(mx) : `${fmtNum(mn)}–${fmtNum(mx)} kg`;
}

/** "40 kg × 12, RIR 2" */
export function setText(ex: Pick<Exercise, 'unit'>, s: { weight: number | null; reps: number; rir: number | null }): string {
  const w = s.weight ? `${fmtNum(s.weight)} kg × ` : '';
  const unit = ex.unit === 's' ? ' s' : '';
  const rir = s.rir != null ? `, RIR ${fmtNum(s.rir)}` : '';
  return `${w}${s.reps}${unit}${rir}`;
}
