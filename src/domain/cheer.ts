/* ==========================================================
   Rocky anima a seguir día a día: un mensaje según cómo va la
   semana (cuántos entrenamientos faltan, si hoy ya entrenaste o
   si hace días que no vienes). Sin culpas: siempre en positivo.
   ========================================================== */
import { weeklyCounts } from './consistency';
import { DAY_MS, sameDay } from './format';
import type { Workout } from './types';

export type CheerPose = 'party' | 'flex' | 'sad';
export interface Cheer { pose: CheerPose; text: string }

/** Días sin entrenar a partir de los que Rocky te echa de menos. */
export const CHEER_IDLE_DAYS = 4;

const left = (n: number) => (n === 1 ? 'Te falta 1 entrenamiento' : `Te faltan ${n} entrenamientos`);

/** Resultado de la semana para el resumen final: "¡Semana cumplida!" o cuántos faltan. */
export function weekCheer(count: number, goal: number): string {
  return count >= goal
    ? `¡Semana cumplida! ${count} de ${goal} entrenamientos.`
    : `Llevas ${count} de ${goal} esta semana. ${left(goal - count)} para cumplirla.`;
}

/** Mensaje de Hoy. `dayName`: el día que toca ("Torso A"). */
export function dailyCheer(workouts: Workout[], goal: number, dayName: string, now = Date.now()): Cheer {
  const done = workouts.filter(w => w.status === 'completed' && w.completed_at);
  const count = weeklyCounts(done, 1, now)[0].count;
  if (done.some(w => sameDay(w.completed_at!, now))) {
    return { pose: 'party', text: count >= goal ? '¡Hoy ya entrenaste y la semana está cumplida! Descansa, te lo ganaste.' : `¡Hoy ya entrenaste! ${count} de ${goal} esta semana. Mañana, a por más.` };
  }
  if (count >= goal) return { pose: 'party', text: '¡Semana cumplida! Lo que hagas de más es un extra.' };
  if (!done.length) return { pose: 'flex', text: `¡Tu primer entrenamiento! Empieza por ${dayName}.` };
  const last = Math.max(...done.map(w => +new Date(w.completed_at!)));
  const idle = Math.floor((now - last) / DAY_MS);
  if (idle >= CHEER_IDLE_DAYS) return { pose: 'sad', text: `Hace ${idle} días que no entrenas. Te echo de menos… ¿hacemos ${dayName}?` };
  return { pose: 'flex', text: `${left(goal - count)} para cumplir la semana. ¡Hoy toca ${dayName}!` };
}
