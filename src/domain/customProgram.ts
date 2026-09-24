/* ==========================================================
   Rutinas propias del entrenador: crear, duplicar y validar.
   Se guardan como un Program más (mismo formato que las incluidas),
   con id "custom:<uuid>". Las rutinas incluidas no se modifican nunca.
   ========================================================== */
import { DEFAULT_WEIGHT_STEP } from './routines';
import type { DayColor, Exercise, Program, WorkoutDay } from './types';

export const CUSTOM_PREFIX = 'custom:';
export const isCustomId = (id: string) => id.startsWith(CUSTOM_PREFIX);
export const customUuid = (id: string) => id.slice(CUSTOM_PREFIX.length);

export const DAY_COLORS: DayColor[] = ['red', 'blue', 'yellow', 'green', 'black'];

const uuid = () => globalThis.crypto.randomUUID();

export function blankDay(index: number, existing: WorkoutDay[] = []): WorkoutDay {
  let n = index + 1;
  const ids = new Set(existing.map(d => d.id));
  while (ids.has(`D${n}`)) n++;
  return { id: `D${n}`, name: `Día ${n}`, focus: '', color: DAY_COLORS[index % DAY_COLORS.length], exercises: [] };
}

export function blankProgram(coachName = ''): Program {
  return {
    id: CUSTOM_PREFIX + uuid(),
    custom: true,
    coachName,
    name: 'Rutina nueva',
    shortName: 'Rutina nueva',
    audience: '',
    level: '',
    daysPerWeek: '3',
    description: '',
    intensity: '',
    progression: { minRirToProgress: 1, cautious: false, step: 'el incremento mínimo disponible' },
    safety: { requiresHealthNotice: false, warnings: [], rules: [] },
    weekPlan: [],
    cardio: '',
    tips: [],
    days: [blankDay(0)]
  };
}

/** Copia editable de una rutina (incluida o propia). La rutina original no cambia. */
export function duplicateProgram(p: Program, coachName = ''): Program {
  const copy: Program = structuredClone(p);
  return { ...copy, id: CUSTOM_PREFIX + uuid(), custom: true, coachName, name: `Copia de ${p.name}`, shortName: `Copia de ${p.shortName}` };
}

/** Plan semanal por defecto: los días seguidos desde el lunes, uno sí y otro no si caben. */
export function defaultWeekPlan(days: WorkoutDay[]): [string, string | null][] {
  const letters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const n = days.length;
  const slots = n <= 3 ? [0, 2, 4] : n === 4 ? [0, 1, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
  return letters.map((l, i) => [l, days[slots.indexOf(i)]?.id ?? null]);
}

export interface ProgramIssue { path: string; message: string }

/** Comprueba que la rutina se puede usar en Hoy (lo mismo que garantizan las incluidas). */
export function validateProgram(p: Program): ProgramIssue[] {
  const out: ProgramIssue[] = [];
  if (!p.name.trim()) out.push({ path: 'name', message: 'Ponle un nombre a la rutina.' });
  if (!p.days.length) out.push({ path: 'days', message: 'Añade al menos un día.' });
  const dayIds = new Set<string>();
  p.days.forEach((d, i) => {
    const at = `Día ${i + 1}`;
    if (!d.name.trim()) out.push({ path: `days.${i}.name`, message: `${at}: ponle un nombre.` });
    if (dayIds.has(d.id)) out.push({ path: `days.${i}.id`, message: `${at}: la abreviatura "${d.id}" está repetida.` });
    dayIds.add(d.id);
    if (!/^[A-Z0-9]{1,3}$/.test(d.id)) out.push({ path: `days.${i}.id`, message: `${at}: la abreviatura debe tener 1–3 letras o números en mayúscula.` });
    if (!d.exercises.length) out.push({ path: `days.${i}.exercises`, message: `${at}: añade al menos un ejercicio.` });
    const keys = new Set<string>();
    d.exercises.forEach((e, j) => {
      const et = `${at}, ejercicio ${j + 1}`;
      if (keys.has(e.key)) out.push({ path: `days.${i}.exercises.${j}`, message: `${et}: "${e.name}" está repetido en el mismo día.` });
      keys.add(e.key);
      if (!e.name.trim()) out.push({ path: `days.${i}.exercises.${j}.name`, message: `${et}: ponle un nombre.` });
      if (!(e.sets >= 1 && e.sets <= 10)) out.push({ path: `days.${i}.exercises.${j}.sets`, message: `${et}: entre 1 y 10 series.` });
      const max = e.unit === 's' ? 600 : 50;
      if (!(e.reps.min >= 1 && e.reps.max >= e.reps.min && e.reps.max <= max)) out.push({ path: `days.${i}.exercises.${j}.reps`, message: `${et}: el rango de ${e.unit === 's' ? 'segundos' : 'repeticiones'} no es válido.` });
      if (!(e.rest >= 15 && e.rest <= 600)) out.push({ path: `days.${i}.exercises.${j}.rest`, message: `${et}: el descanso debe estar entre 15 s y 10 min.` });
      if (!(e.weightStep > 0 && e.weightStep <= 10)) out.push({ path: `days.${i}.exercises.${j}.weightStep`, message: `${et}: el paso de peso no es válido.` });
      if (!/^\d(-\d)?$/.test(e.rir)) out.push({ path: `days.${i}.exercises.${j}.rir`, message: `${et}: el RIR tiene que ser un número o un rango (por ejemplo 2 o 2-3).` });
    });
  });
  if (p.safety.requiresHealthNotice) {
    if (!p.safety.warnings.some(w => w.trim())) out.push({ path: 'safety.warnings', message: 'El aviso de salud necesita al menos un texto.' });
    if (!p.safety.ackText?.trim()) out.push({ path: 'safety.ackText', message: 'Escribe el texto de la casilla que tiene que aceptar la persona.' });
  }
  return out;
}

/** Deja la rutina lista para guardar: plan semanal y textos recortados. */
export function normalizeProgram(p: Program): Program {
  const q = structuredClone(p);
  q.name = q.name.trim();
  q.shortName = (q.shortName || q.name).trim();
  q.daysPerWeek = String(q.days.length);
  q.safety.warnings = q.safety.warnings.map(w => w.trim()).filter(Boolean);
  q.safety.rules = (q.safety.rules || []).map(w => w.trim()).filter(Boolean);
  q.tips = q.tips.map(t => t.trim()).filter(Boolean);
  const ids = q.days.map(d => d.id);
  // Plan por defecto si no hay plan o apunta a días que ya no existen (un día sin hueco en la semana es válido)
  if (q.weekPlan.length !== 7 || q.weekPlan.some(([, id]) => id && !ids.includes(id))) {
    q.weekPlan = defaultWeekPlan(q.days);
  }
  return q;
}

/* ---------- Ejercicios de ExerciseDB ---------- */

export interface ExerciseDbItem {
  exerciseId: string;
  name: string;
  gifUrl: string;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

const MUSCLES_ES: Record<string, string> = {
  abs: 'abdominales', quads: 'cuádriceps', glutes: 'glúteos', hamstrings: 'isquiotibiales', calves: 'gemelos',
  pectorals: 'pectoral', lats: 'dorsales', 'upper back': 'espalda alta', traps: 'trapecio', delts: 'deltoides',
  biceps: 'bíceps', triceps: 'tríceps', forearms: 'antebrazos', spine: 'zona lumbar', adductors: 'aductores',
  abductors: 'abductores', 'serratus anterior': 'serrato', 'levator scapulae': 'elevador de la escápula',
  'cardiovascular system': 'sistema cardiovascular', obliques: 'oblicuos', 'hip flexors': 'flexores de la cadera',
  shoulders: 'hombros', chest: 'pecho', 'lower back': 'zona lumbar', core: 'core', back: 'espalda',
  'rear deltoids': 'deltoide posterior', rhomboids: 'romboides', quadriceps: 'cuádriceps', trapezius: 'trapecio'
};
const EQUIPMENT_ES: Record<string, string> = {
  'body weight': 'peso corporal', dumbbell: 'mancuernas', barbell: 'barra', 'olympic barbell': 'barra olímpica',
  'ez barbell': 'barra Z', cable: 'polea', 'leverage machine': 'máquina', 'smith machine': 'máquina Smith',
  kettlebell: 'kettlebell', band: 'banda', 'resistance band': 'banda elástica', 'stability ball': 'fitball',
  'medicine ball': 'balón medicinal', 'bosu ball': 'bosu', 'sled machine': 'prensa', 'trap bar': 'barra hexagonal',
  weighted: 'con lastre', assisted: 'asistido', rope: 'cuerda', roller: 'rodillo', 'wheel roller': 'rueda abdominal',
  'stationary bike': 'bici estática', 'elliptical machine': 'elíptica', 'stepmill machine': 'escaladora',
  'skierg machine': 'SkiErg', 'upper body ergometer': 'ergómetro de brazos', tire: 'neumático', hammer: 'mazo'
};
export const muscleEs = (m: string) => MUSCLES_ES[m] || m;
export const equipmentEs = (e: string) => EQUIPMENT_ES[e] || e;

/** Figura SVG más parecida según el músculo principal (si no hay GIF, o con movimiento reducido). */
const POSE_BY_TARGET: Record<string, string> = {
  quads: 'squat', glutes: 'hipthrust', hamstrings: 'legcurl', calves: 'calf', pectorals: 'bench', lats: 'pullup',
  'upper back': 'row', traps: 'facepull', delts: 'ohp', biceps: 'curl', triceps: 'pushdown', abs: 'plank',
  spine: 'hipext45', adductors: 'abductor', abductors: 'abductor', forearms: 'farmer', 'serratus anterior': 'bench',
  'cardiovascular system': 'walklunge'
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Borrador de ejercicio a partir de ExerciseDB. El nombre se deja en inglés para que el entrenador lo traduzca. */
export function exerciseFromDb(e: ExerciseDbItem): Exercise {
  const eq = e.equipments[0] || '';
  const barbellLike = ['barbell', 'olympic barbell', 'trap bar', 'smith machine', 'ez barbell'].includes(eq);
  return {
    key: `edb_${e.exerciseId}`,
    name: cap(e.name),
    sets: 3,
    reps: { min: 8, max: 12 },
    unit: 'reps',
    rir: '2',
    rest: barbellLike ? 120 : 90,
    pose: POSE_BY_TARGET[e.targetMuscles[0]] || 'plank',
    muscle: cap(e.targetMuscles.map(muscleEs).join(', ')),
    cue: '',
    alt: '',
    perSide: false,
    warn: '',
    compound: barbellLike,
    weightStep: eq === 'dumbbell' || eq === 'kettlebell' ? 1 : DEFAULT_WEIGHT_STEP,
    exercisedbId: e.exerciseId,
    gifUrl: e.gifUrl,
    instructions: e.instructions.map(s => s.replace(/^Step:\d+\s*/, ''))
  };
}

/** Clave única dentro del día (un mismo ejercicio en dos días comparte historial). */
export function uniqueKey(base: string, day: WorkoutDay): string {
  let k = base, n = 2;
  while (day.exercises.some(e => e.key === k)) k = `${base}_${n++}`;
  return k;
}
