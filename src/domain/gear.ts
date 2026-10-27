/* ==========================================================
   Qué llevar hoy: agua y toalla siempre, y el material que piden
   los ejercicios del día (guantes para el agarre, tobillera para la
   polea, pesoneras, banda, esterilla). Solo es un recordatorio.
   ========================================================== */
import { norm } from './csv';
import type { Exercise, WorkoutDay } from './types';

export interface GearItem {
  id: 'agua' | 'toalla' | 'guantes' | 'tobillera' | 'pesoneras' | 'banda' | 'esterilla';
  name: string;
  why: string;
}

const GRIP_POSES = new Set(['deadlift', 'rdl', 'row', 'pullup', 'farmer']);
const GRIP = /peso muerto|remo|dominad|jalon|colgar|granjero|pinza|sostener|encogimiento/;
const LEG_KICK = /patada|kick|abduccion|elevacion de pierna|cuadrupedia/;
const MAT = /plancha|puente|gato y vaca|cuadrupedia|estiramiento|flexibilidad|movilidad|rotacion|abdominal|suelo|colchoneta|fascia|dead bug/;

/** El material del día, en el orden en que conviene prepararlo. */
export function gearFor(day: Pick<WorkoutDay, 'exercises'>): GearItem[] {
  const list = day.exercises.filter(e => !e.cardioSlot);
  const n = (e: Exercise) => norm(e.name);
  const first = (test: (e: Exercise) => boolean) => list.find(test)?.name;
  const out: GearItem[] = [
    { id: 'agua', name: 'Agua', why: 'Bebe un poco entre ejercicios.' },
    { id: 'toalla', name: 'Toalla', why: 'Para el banco y las máquinas.' }
  ];
  const grip = first(e => GRIP_POSES.has(e.pose) || GRIP.test(n(e)));
  if (grip) out.push({ id: 'guantes', name: 'Guantes o magnesio', why: `Para el agarre en ${grip}.` });
  const ankle = first(e => LEG_KICK.test(n(e)) && /polea|cable/.test(n(e)));
  if (ankle) out.push({ id: 'tobillera', name: 'Tobillera para la polea', why: `Para ${ankle}.` });
  // En máquina (bloques), polea o con banda no hacen falta pesoneras
  const weights = first(e => LEG_KICK.test(n(e)) && e.load !== 'bloques' && !/polea|cable|maquina|banda/.test(n(e)));
  if (weights) out.push({ id: 'pesoneras', name: 'Pesoneras', why: `Tobilleras con peso para ${weights}.` });
  const band = first(e => /\bbanda|\bband\b/.test(n(e)));
  if (band) out.push({ id: 'banda', name: 'Banda elástica', why: `Para ${band}.` });
  const mat = first(e => e.pose === 'plank' || e.pose === 'glutebridge' || MAT.test(n(e)));
  if (mat) out.push({ id: 'esterilla', name: 'Esterilla', why: `Para los ejercicios en el suelo, como ${mat}.` });
  return out;
}
