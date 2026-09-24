/* Constancia semanal: entrenamientos completados por semana (lunes a domingo) y racha. */
import { DAY_MS, localDate } from './format';
import type { Program, Workout } from './types';

/** Lunes 00:00 (hora local) de la semana de esa fecha. */
export function weekStart(d: Date | string | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - dow);
  return x;
}

/** Objetivo semanal: los días de la rutina que no son opcionales. */
export const weeklyGoal = (p: Program) => Math.max(1, p.days.filter(d => !d.optional).length);

export interface WeekCount { start: string; count: number }

export function weeklyCounts(workouts: Workout[], weeks: number, now = Date.now()): WeekCount[] {
  const done = workouts.filter(w => w.status === 'completed' && w.completed_at);
  const cur = weekStart(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(cur);
    start.setDate(start.getDate() - (weeks - 1 - i) * 7);
    const end = +start + 7 * DAY_MS;
    return { start: localDate(start), count: done.filter(w => +new Date(w.completed_at!) >= +start && +new Date(w.completed_at!) < end).length };
  });
}

/** Semanas seguidas cumpliendo el objetivo. La semana actual cuenta solo si ya se cumplió. */
export function streak(workouts: Workout[], goal: number, now = Date.now()): number {
  const counts = weeklyCounts(workouts, 104, now);
  let n = 0;
  const last = counts.length - 1;
  if (counts[last].count >= goal) n++;
  for (let i = last - 1; i >= 0; i--) {
    if (counts[i].count >= goal) n++; else break;
  }
  return n;
}
