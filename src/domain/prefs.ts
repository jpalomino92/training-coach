/* Preferencias con sus valores por defecto y el descanso que se aplica a cada ejercicio. */
import type { Exercise, Prefs, Profile, Program } from './types';

export const DEFAULT_PREFS: Prefs = {
  rest_mode: 'routine',
  rest_compound: 120,
  rest_accessory: 60,
  sound: true,
  keep_awake: false,
  bar_kg: 20
};

export const REST_MIN = 15;
export const REST_MAX = 600;
export const REST_STEP = 15;

export const prefsOf = (p: Pick<Profile, 'prefs'> | null | undefined): Prefs => ({ ...DEFAULT_PREFS, ...(p?.prefs || {}) });

const clampRest = (s: number) => Math.min(REST_MAX, Math.max(REST_MIN, Math.round(s)));

/** Descanso que usa el temporizador: el de la rutina o el personalizado (básicos / accesorios). */
export function restFor(ex: Pick<Exercise, 'rest' | 'compound'>, prefs: Prefs): number {
  if (prefs.rest_mode !== 'custom') return ex.rest;
  return clampRest(ex.compound ? prefs.rest_compound : prefs.rest_accessory);
}

/** "2:00", "1:30", "45 s" */
export const restClock = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/** Semana tipo que se muestra: la que eligió la persona (si sigue siendo válida) o la de la rutina. */
export function weekPlanFor(program: Pick<Program, 'id' | 'weekPlan' | 'days'>, prefs: Prefs): [string, string | null][] {
  const own = prefs.week_plans?.[program.id];
  const ids = program.days.map(d => d.id);
  const valid = own && own.length === program.weekPlan.length && own.every(([l, id], i) => l === program.weekPlan[i]?.[0] && (id == null || ids.includes(id)));
  return valid ? own : program.weekPlan;
}
