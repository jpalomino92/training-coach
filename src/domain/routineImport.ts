/* ==========================================================
   Importar una rutina desde una planilla (Excel o CSV).
   Una fila por ejercicio: día, ejercicio, series, repeticiones y,
   si están, RIR (o RPE), descanso, biserie y notas. Entiende la
   forma habitual de escribirlas: "4x8-12", "30s", "RPE 8", "2 min",
   "1:30", "por lado"… Los ejercicios se emparejan con los de las
   rutinas incluidas para compartir historial, dibujo y técnica.
   El resultado siempre pasa por el editor antes de guardarse.
   ========================================================== */
import { asOwnProgram, blankProgram, DAY_COLORS, normalizeProgram } from './customProgram';
import { columns, norm, toCsv, type CsvError } from './csv';
import { DEFAULT_POSE } from './poses';
import { DEFAULT_WEIGHT_STEP, programList } from './routines';
import type { Exercise, Program, Unit, WorkoutDay } from './types';

export interface SheetRows { name: string; rows: string[][] }

export interface RoutineImport {
  /** null si no se pudo leer ningún ejercicio. */
  program: Program | null;
  errors: CsvError[];
  /** Avisos generales (valores que se completaron por defecto, etc.). */
  notes: string[];
  /** Claves de los ejercicios que conviene revisar (no se reconocieron). */
  review: string[];
  matched: number;
  total: number;
}

const COLS = {
  exercise: ['ejercicio', 'ejercicios', 'exercise', 'nombre'],
  day: ['dia', 'day', 'sesion', 'entrenamiento', 'rutina'],
  sets: ['series', 'sets', 'serie', 'n series'],
  reps: ['reps', 'repeticiones', 'rep', 'rango', 'series x reps', 'tiempo', 'segundos', 'duracion'],
  rir: ['rir', 'rpe', 'intensidad', 'esfuerzo'],
  rest: ['descanso', 'rest', 'pausa', 'recuperacion'],
  group: ['biserie', 'superserie', 'grupo', 'circuito'],
  notes: ['notas', 'nota', 'observaciones', 'tecnica', 'indicaciones', 'comentarios']
};

/* ---------- Lectura de cada celda ---------- */

const PER_SIDE = /\b(por|cada|c\/?)\s*(lado|pierna|brazo)\b|\bunilateral\b/i;

/** Repeticiones hasta el fallo (sin número): "al fallo", "AMRAP", "máximo". */
export const isToFailure = (raw: string) => /^(al )?fallo$|^amrap$|^max(imo|imas)?( rep(eticione)?s?)?$|^todas las (que puedas|posibles)$/.test(norm(raw));

/**
 * "4x8-12", "8 a 12", "30s", "45 seg", "5 min", "10 reps", "3 series de 10", pirámides "12-10-8"
 * → series (si vienen), rango y unidad.
 */
export function parseTarget(raw: string): { sets?: number; min: number; max: number; unit: Unit } | null {
  const s = norm(raw.replace(/[×*]/g, 'x').replace(/(\d)\s*x\s*(\d)/gi, '$1 x $2').replace(/''|["”]/g, ' s ').replace(/['’]/g, ' min ').replace(/(\d)([a-z])/gi, '$1 $2'))
    .replace(/\b(por|cada|c) (lado|pierna|brazo)\b|\bunilateral\b|\bc u\b|\bcada uno\b|\baprox\w*/g, '')
    .replace(/^(\d+) series? (de|x) /, '$1 x ').replace(/\s+/g, ' ').trim();
  // Pirámide (12-10-8 o 12/10/8): el rango de menor a mayor, una serie por número
  const pyr = /^(?:(\d+) x )?(\d+(?: \d+){2,})(?: (rep|reps|repeticiones))?$/.exec(s);
  if (pyr) {
    const nums = pyr[2].split(' ').map(Number);
    return { sets: pyr[1] ? Number(pyr[1]) : nums.length, min: Math.min(...nums), max: Math.max(...nums), unit: 'reps' };
  }
  const m = /^(?:(\d+) x )?(\d+)(?: (?:a|-)? ?(\d+))?(?: (s|seg|segs|segundos|sec|min|mins|minutos|minuto|rep|reps|repeticiones))?$/.exec(s);
  if (!m) return null;
  const unit: Unit = !m[4] || /^rep/.test(m[4]) ? 'reps' : /^min/.test(m[4]) ? 'min' : 's';
  const a = Number(m[2]), b = m[3] ? Number(m[3]) : a;
  return { ...(m[1] ? { sets: Number(m[1]) } : {}), min: Math.min(a, b), max: Math.max(a, b), unit };
}

/** RIR como texto ("2" o "1-2"). Acepta "RIR 2", "RPE 8" (→ RIR 2) y "al fallo" (→ 0). null si no se entiende. */
export function parseRir(raw: string, rpeColumn = false): { rir: string; fromRpe: boolean } | null {
  const s = raw.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/(\d),(\d)/g, '$1.$2');
  if (!s) return { rir: '', fromRpe: false };
  if (/fallo|failure/.test(s)) return { rir: '0', fromRpe: false };
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  // Solo números (uno o un rango) y las palabras RIR o RPE
  if (!nums.length || nums.length > 2 || s.replace(/rpe|rir|\d+(?:\.\d+)?|[\s:@a-]/g, '')) return null;
  const tag = /rpe/.test(s) ? 'rpe' : /rir/.test(s) ? 'rir' : '';
  const rpe = tag === 'rpe' || (tag === '' && (rpeColumn || nums.some(n => n > 5)));
  const vals = (rpe ? nums.map(n => 10 - n) : nums).map(n => Math.max(0, Math.min(5, Math.round(n)))).sort((x, y) => x - y);
  const [lo, hi] = [vals[0], vals[vals.length - 1]];
  return { rir: lo === hi ? String(lo) : `${lo}-${hi}`, fromRpe: rpe };
}

/** Descanso en segundos: "90", "90 s", "2 min", "2'", "1:30", "1'30''", "1,5 min". Un número suelto ≤ 10 son minutos. */
export function parseRest(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  let m = /^(\d+):(\d{1,2})$/.exec(s) || /^(\d+)\s*(?:'|’|min)\s*(\d{1,2})\s*(?:''|"|”|s|seg)?$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+(?:\.\d+)?)\s*(s|seg|segs|segundos|sec|"|''|min|mins|minutos|minuto|'|’)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  const minutes = m[2] ? /^(min|'|’)/.test(m[2]) && m[2] !== "''" : n <= 10;
  return Math.round(minutes ? n * 60 : n);
}

/* ---------- Catálogo de ejercicios ---------- */

const STOP = new Set(['de', 'del', 'con', 'en', 'la', 'el', 'los', 'las', 'a', 'al', 'y', 'para', 'o']);
/** Nombre comparable: sin tildes, sin palabras vacías, sin plurales y en cualquier orden. */
export const canon = (s: string) => norm(s.replace(/\(.*?\)/g, ' ')).split(' ')
  .filter(w => w && !STOP.has(w)).map(w => (w.length > 3 ? w.replace(/(es|s)$/, '') : w)).sort().join(' ');

/** Otras formas de llamar a los ejercicios de las rutinas incluidas (en español y en inglés). */
const ALIASES: Record<string, string[]> = {
  bench_press: ['press de banca', 'press banca plano', 'press plano con barra', 'bench press'],
  squat_bar: ['sentadilla', 'sentadilla libre', 'sentadilla trasera', 'back squat', 'squat'],
  deadlift: ['peso muerto', 'deadlift'],
  rdl_bar: ['rdl', 'romanian deadlift', 'peso muerto rumano con barra'],
  rdl_db: ['rdl con mancuernas', 'peso muerto rumano mancuernas'],
  lat_pulldown: ['jalon', 'jalon dorsal', 'polea al pecho', 'lat pulldown', 'jalon al pecho agarre abierto'],
  pullup: ['dominadas', 'dominada', 'pull up', 'pull ups', 'chin up'],
  hip_thrust: ['hip thrust', 'empuje de cadera'],
  leg_press: ['prensa', 'prensa 45', 'prensa inclinada', 'leg press'],
  leg_ext: ['extension de cuadriceps', 'extensiones de cuadriceps', 'sillon de cuadriceps', 'leg extension'],
  leg_curl_lying: ['curl femoral', 'curl femoral acostado', 'camilla femoral', 'leg curl', 'lying leg curl'],
  lateral_raise: ['vuelos laterales', 'elevaciones laterales con mancuernas', 'elevacion lateral', 'lateral raise'],
  shoulder_press_db: ['press militar', 'press de hombros', 'press de hombro con mancuernas', 'shoulder press'],
  curl_db: ['curl biceps', 'curl con mancuernas', 'biceps curl', 'dumbbell curl'],
  hammer_curl: ['hammer curl'],
  triceps_pushdown: ['triceps en polea', 'extension de triceps en polea', 'pushdown', 'triceps pushdown'],
  face_pull: ['facepull'],
  row_bar: ['remo barra', 'barbell row', 'remo pendlay'],
  one_arm_row: ['remo con mancuerna', 'remo serrucho', 'remo a una mano', 'one arm row'],
  cable_row: ['remo en polea', 'remo sentado', 'remo gironda', 'seated row', 'seated cable row'],
  incline_db: ['press inclinado', 'press inclinado mancuernas', 'incline press', 'incline dumbbell press'],
  calf_standing: ['gemelos', 'pantorrillas', 'elevacion de talones', 'calf raise', 'standing calf raise'],
  calf_seated: ['seated calf raise'],
  walking_lunge: ['estocadas', 'estocadas caminando', 'zancadas', 'lunges', 'walking lunges'],
  bulgarian_split: ['bulgara', 'bulgarian split squat'],
  dips: ['fondos', 'fondos en paralelas', 'dips'],
  farmer_walk: ['paseo de granjero', 'caminata del granjero', 'farmer walk'],
  dead_hang: ['colgarse', 'colgado en barra', 'dead hang'],
  hack_squat: ['sentadilla hack', 'hack squat', 'sentadilla frontal', 'front squat'],
  smith_squat: ['sentadilla smith', 'smith squat'],
  reverse_fly: ['pajaros', 'vuelos posteriores', 'reverse fly', 'rear delt fly']
};

let catalogCache: Map<string, Exercise> | null = null;

/** Nombre comparable → ejercicio de las rutinas incluidas. */
function catalog(): Map<string, Exercise> {
  if (catalogCache) return catalogCache;
  const byKey = new Map<string, Exercise>();
  for (const p of programList()) for (const d of p.days) for (const e of d.exercises) if (!byKey.has(e.key)) byKey.set(e.key, e);
  const out = new Map<string, Exercise>();
  for (const e of byKey.values()) {
    const c = canon(e.name);
    // Los nombres de una sola palabra del especialista ("Extensión", "Flexión") son demasiado genéricos
    if (e.key.startsWith('sp_') && !c.includes(' ')) continue;
    if (!out.has(c)) out.set(c, e);
  }
  for (const [key, names] of Object.entries(ALIASES)) {
    const e = byKey.get(key);
    if (e) for (const n of names) if (!out.has(canon(n))) out.set(canon(n), e);
  }
  return (catalogCache = out);
}

/** Ejercicio de las rutinas incluidas con ese nombre, o null. */
export function matchExercise(name: string): Exercise | null {
  return catalog().get(canon(name)) || null;
}

/** Dibujo aproximado para un ejercicio que no está en el catálogo. */
const POSE_HINTS: [RegExp, string][] = [
  [/rumano|rdl/, 'rdl'], [/peso muerto|deadlift/, 'deadlift'], [/hip thrust|empuje de cadera/, 'hipthrust'], [/puente|bridge/, 'glutebridge'],
  [/bulgara|zancada|estocada|lunge/, 'lunge'], [/prensa|leg press/, 'legpress'], [/sentadilla|squat/, 'squat'], [/femoral|leg curl/, 'legcurl'],
  [/cuadricep|leg extension/, 'legext'], [/gemelo|pantorrilla|talon|calf/, 'calf'], [/apertura|pec deck|cruce/, 'pecdeck'],
  [/pajaro|posterior|reverse fly/, 'reversefly'], [/face pull/, 'facepull'], [/lateral/, 'lateral'], [/militar|hombro|shoulder/, 'ohp'],
  [/inclinad|incline/, 'incline'], [/banca|bench|pecho/, 'bench'], [/jalon|dominada|pull ?up|pulldown/, 'pullup'], [/pullover/, 'pullover'],
  [/remo|row/, 'row'], [/martillo|curl/, 'curl'], [/fondo|dip/, 'dips'], [/tricep|pushdown/, 'pushdown'], [/plancha|plank/, 'plank'],
  [/abduc|aduc/, 'abductor'], [/patada|kickback/, 'kickback'], [/granjero|farmer/, 'farmer'], [/escalon|step/, 'stepup']
];
const COMPOUND_POSES = new Set(['squat', 'deadlift', 'rdl', 'legpress', 'bench', 'incline', 'row', 'ohp', 'pullup', 'hipthrust', 'dips', 'lunge']);

const slug = (s: string) => norm(s).replace(/ /g, '_').slice(0, 40) || 'ejercicio';

function newExercise(name: string): Exercise {
  const n = norm(name);
  const pose = POSE_HINTS.find(([re]) => re.test(n))?.[1] || DEFAULT_POSE;
  const compound = COMPOUND_POSES.has(pose);
  return {
    key: `own_${slug(name)}`, name, sets: 3, reps: { min: 8, max: 12 }, unit: 'reps', rir: '2', rest: compound ? 120 : 90,
    pose, muscle: '', cue: '', alt: '', perSide: false, warn: '', compound,
    weightStep: /mancuerna|dumbbell|kettlebell/.test(n) ? 1 : DEFAULT_WEIGHT_STEP
  };
}

/* ---------- Días ---------- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "1" → "Día 1"; el resto se deja como está. */
const dayName = (raw: string) => (/^\d+$/.test(raw.trim()) ? `Día ${raw.trim()}` : /^[a-z]$/i.test(raw.trim()) ? `Día ${raw.trim().toUpperCase()}` : cap(raw.trim()).slice(0, 30));

/** Abreviatura de 1–3 letras o números, sin repetir: "Día 2" → "D2", "Día A" → "A", "Pierna y glúteo" → "PG". */
function dayId(name: string, taken: Set<string>): string {
  const words = norm(name).split(' ').filter(w => w && !STOP.has(w));
  const rest = words[0] === 'dia' || words[0] === 'sesion' || words[0] === 'session' || words[0] === 'day' ? words.slice(1) : words;
  let id = rest.length === 1 && /^\d{1,2}$/.test(rest[0]) ? `D${rest[0]}`
    : rest.length === 1 && rest[0].length <= 3 ? rest[0].toUpperCase()
    : rest.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  if (!/^[A-Z0-9]{1,3}$/.test(id)) id = `D${taken.size + 1}`;
  let out = id, n = 2;
  while (taken.has(out) && n < 100) out = `${id.slice(0, 1)}${n++}`;
  taken.add(out);
  return out;
}

/* ---------- Importación ---------- */

/** Fila de cabecera: la primera (de las 10 primeras) que tiene la columna de ejercicio. */
function findHeader(rows: string[][]): number {
  const ex = new Set(COLS.exercise);
  return rows.slice(0, 10).findIndex(r => r.some(c => ex.has(norm(c))));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Convierte las hojas de una planilla en una rutina propia lista para revisar.
 * Con columna "día" se usa esa columna (una celda vacía sigue en el día anterior);
 * sin ella, cada hoja con ejercicios es un día.
 */
export function importRoutine(sheets: SheetRows[], fileName = ''): RoutineImport {
  const res: RoutineImport = { program: null, errors: [], notes: [], review: [], matched: 0, total: 0 };
  const parsed = sheets.map(s => ({ ...s, rows: s.rows.map(r => r.map(c => (c ?? '').trim())) }))
    .map(s => ({ ...s, header: findHeader(s.rows) })).filter(s => s.header >= 0);
  if (!parsed.length) {
    res.errors.push({ line: 1, message: 'No se encontró la fila de títulos: tiene que haber una columna "ejercicio" (descarga la plantilla para ver el formato).' });
    return res;
  }
  const multiSheet = parsed.length > 1;
  let dayColumn = false;
  const days: WorkoutDay[] = [];
  const takenIds = new Set<string>();
  const counts = { noSets: 0, noRest: 0, noRir: 0, rpe: 0 };
  const groupsByDay = new Map<WorkoutDay, Map<string, number>>();

  const dayFor = (raw: string): WorkoutDay => {
    const name = dayName(raw);
    let d = days.find(x => norm(x.name) === norm(name));
    if (!d) {
      d = { id: dayId(name, takenIds), name, focus: '', color: DAY_COLORS[days.length % DAY_COLORS.length], exercises: [] };
      days.push(d);
    }
    return d;
  };

  for (const sheet of parsed) {
    const cols = columns(sheet.rows[sheet.header], COLS, ['exercise']);
    if (typeof cols === 'string') continue;
    if (cols.day >= 0) dayColumn = true;
    const rpeColumn = cols.rir >= 0 && /rpe/.test(norm(sheet.rows[sheet.header][cols.rir]));
    let current: WorkoutDay | null = null;
    sheet.rows.forEach((r, i) => {
      if (i <= sheet.header) return;
      const name = (r[cols.exercise] || '').replace(/\s+/g, ' ').trim();
      const dayCell = cols.day >= 0 ? r[cols.day] || '' : '';
      if (dayCell) current = dayFor(dayCell);
      if (!name) return;
      if (!current) current = dayFor(cols.day >= 0 || !multiSheet ? 'Día 1' : sheet.name);
      const day: WorkoutDay = current;

      const repsCell = cols.reps >= 0 ? r[cols.reps] || '' : '';
      const setsCell = cols.sets >= 0 ? r[cols.sets] || '' : '';
      // Un dato que no se entiende no descarta el ejercicio: se pone un valor habitual y se marca para revisar
      const guessed: string[] = [];
      // "4x10" puede venir en la columna de series o en la de repeticiones
      const toFailure = isToFailure(repsCell);
      let target = parseTarget(repsCell) || (!repsCell && /x|serie/i.test(setsCell) ? parseTarget(setsCell) : null);
      if (!target) {
        target = { min: 8, max: 12, unit: 'reps' };
        if (toFailure) guessed.push(`"${repsCell}" no tiene número de repeticiones: se puso 8-12 y RIR 0`);
        else if (repsCell || setsCell) guessed.push(`no se entendieron las repeticiones ("${repsCell || setsCell}"): se puso 8-12`);
        else guessed.push('no tenía repeticiones: se puso 8-12');
      }
      let sets = target.sets;
      if (sets == null && setsCell && !/x/i.test(setsCell)) {
        const nums = (setsCell.match(/\d+/g) || []).map(Number);
        // "3-4" o "3 a 4": las más
        if (/^\s*\d+\s*((-|a)\s*\d+)?\s*(series?)?\s*$/i.test(setsCell)) sets = Math.max(...nums);
        else guessed.push(`no se entendieron las series ("${setsCell}"): se pusieron 3`);
      }
      if (sets == null) { sets = 3; if (!setsCell) counts.noSets++; }

      const rirCell = cols.rir >= 0 ? r[cols.rir] || '' : '';
      let rir = parseRir(rirCell, rpeColumn);
      if (!rir) { guessed.push(`no se entendió el RIR ("${rirCell}")`); rir = { rir: '', fromRpe: false }; }
      if (toFailure && !rir.rir) rir = { rir: '0', fromRpe: false };
      if (rir.fromRpe) counts.rpe++;
      const rirGiven = !!rir.rir;

      const restCell = cols.rest >= 0 ? r[cols.rest] || '' : '';
      const rest = parseRest(restCell);
      if (restCell && rest == null) guessed.push(`no se entendió el descanso ("${restCell}"): se usó el habitual`);

      const notes = cols.notes >= 0 ? r[cols.notes] || '' : '';
      const base = matchExercise(name);
      res.total++;
      if (base) res.matched++;
      const ex: Exercise = base
        ? { ...structuredClone(base), name, group: undefined, setTechnique: undefined, videoUrl: undefined }
        : newExercise(name);
      const timed = target.unit !== 'reps';
      if (rest == null) { if (!restCell) counts.noRest++; } else ex.rest = rest;
      if (!rirGiven) {
        // Sin RIR: el del catálogo, o 2 (vacío en ejercicios con tiempo, como el cardio o la movilidad)
        if (!base) { ex.rir = timed ? '' : '2'; if (!timed) counts.noRir++; }
      } else ex.rir = rir.rir;
      ex.sets = sets;
      ex.reps = { min: target.min, max: target.max };
      ex.unit = target.unit;
      if (PER_SIDE.test(`${repsCell} ${setsCell} ${notes}`)) ex.perSide = true;
      if (notes) ex.cue = notes.slice(0, 300);
      // Un ejercicio repetido en el mismo día lleva otra clave (el historial se separa)
      let key = ex.key, k = 2;
      while (day.exercises.some(e => e.key === key)) key = `${ex.key}_${k++}`;
      ex.key = key;
      if (!base || guessed.length) res.review.push(key);
      if (guessed.length) res.notes.push(`${name} (${day.name}): ${guessed.join('; ')}.`);

      const g = cols.group >= 0 ? norm(r[cols.group] || '') : '';
      if (g) {
        const prev = day.exercises[day.exercises.length - 1];
        const seen = groupsByDay.get(day) || new Map<string, number>();
        groupsByDay.set(day, seen);
        // Una biserie son ejercicios seguidos con la misma marca
        if (prev?.group && prev.group === `${day.id}-${g}-${seen.get(g)}`) ex.group = prev.group;
        else { seen.set(g, (seen.get(g) || 0) + 1); ex.group = `${day.id}-${g}-${seen.get(g)}`; }
      }
      day.exercises.push(ex);
    });
  }

  // Marcas de biserie con un solo ejercicio: ejercicio normal
  let lonely = 0;
  for (const d of days) for (const e of d.exercises) {
    if (e.group && d.exercises.filter(x => x.group === e.group).length < 2) { e.group = undefined; lonely++; }
  }
  const filled = days.filter(d => d.exercises.length);
  if (!filled.length) {
    if (!res.errors.length) res.errors.push({ line: 1, message: 'No hay ningún ejercicio en el archivo.' });
    return res;
  }
  const unknown = res.total - res.matched;
  if (filled.length > 7) res.notes.push(`El archivo tiene ${filled.length} días; una rutina admite hasta 7. Quita los que sobren antes de guardar.`);
  if (counts.noSets) res.notes.push(`${plural(counts.noSets, 'ejercicio no tenía', 'ejercicios no tenían')} series: se pusieron 3.`);
  if (counts.noRest) res.notes.push(`${plural(counts.noRest, 'ejercicio no tenía', 'ejercicios no tenían')} descanso: se usó el habitual (90 s, o 2 min en los básicos).`);
  if (counts.noRir) res.notes.push(`${plural(counts.noRir, 'ejercicio no tenía', 'ejercicios no tenían')} RIR: se puso 2 (dos repeticiones en reserva).`);
  if (counts.rpe) res.notes.push(`El RPE se pasó a RIR (RPE 8 = RIR 2) en ${plural(counts.rpe, 'ejercicio', 'ejercicios')}.`);
  if (lonely) res.notes.push(`${plural(lonely, 'marca', 'marcas')} de biserie con un solo ejercicio se ${lonely === 1 ? 'ignoró' : 'ignoraron'}: los ejercicios de una biserie tienen que ir seguidos.`);
  if (unknown) res.notes.push(`${plural(unknown, 'ejercicio no está', 'ejercicios no están')} en el catálogo: revisa su dibujo, el músculo y el paso de peso (marcados con "Revisar").`);
  if (!dayColumn && !multiSheet) res.notes.push('No hay columna "día": todos los ejercicios quedaron en un solo día.');

  const name = cap(fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 80) || 'Rutina importada';
  const base = blankProgram();
  res.program = normalizeProgram(asOwnProgram({
    ...base, name, shortName: name.slice(0, 40),
    description: 'Importada desde una planilla.',
    days: filled.slice(0, 7)
  }));
  return res;
}

/** Plantilla para rellenar en Excel (CSV con ';', como la exporta Excel en español). */
export const ROUTINE_TEMPLATE = toCsv([
  ['dia', 'ejercicio', 'series', 'reps', 'rir', 'descanso', 'biserie', 'notas'],
  ['Día 1', 'Sentadilla con barra', 4, '6-8', 2, '3 min', '', ''],
  ['Día 1', 'Prensa', 3, '10-12', 2, 90, '', ''],
  ['Día 1', 'Curl femoral tumbado', 3, '10-12', 1, 60, 'A', ''],
  ['Día 1', 'Extensión de cuádriceps', 3, '12-15', 1, 60, 'A', ''],
  ['Día 2', 'Press banca', 4, '6-8', 2, '3 min', '', ''],
  ['Día 2', 'Remo con barra', 4, '8-10', 2, '2 min', '', ''],
  ['Día 2', 'Elevaciones laterales', 3, '12-15', 1, 60, '', 'Sube hasta la altura del hombro'],
  ['Día 2', 'Paseo del granjero', 3, '30-40s', '', 90, '', '']
]);

/* ---------- Lectura con IA ---------- */

/** Lo que devuelve la Edge Function "import-routine": las mismas columnas que la plantilla. */
export interface AiRoutine {
  name: string;
  description: string;
  /** Advertencias de salud que figuran en el documento. */
  precautions: string[];
  /** Lo que la IA no pudo leer o tuvo que suponer. */
  warnings: string[];
  rows: { day: string; exercise: string; sets: string; reps: string; rir: string; rest: string; group: string; notes: string; uncertain: boolean }[];
}

/** Convierte la lectura de la IA con el mismo importador que una planilla. */
export function importAiRoutine(ai: AiRoutine): RoutineImport {
  const header = ['dia', 'ejercicio', 'series', 'reps', 'rir', 'descanso', 'biserie', 'notas'];
  const rows = ai.rows.map(r => [r.day, r.exercise, r.sets, r.reps, r.rir, r.rest, r.group, r.notes].map(c => String(c ?? '')));
  const res = importRoutine([{ name: 'IA', rows: [header, ...rows] }]);
  // Las filas de la IA no son filas de un archivo: el error se identifica por el ejercicio
  res.errors = res.errors.map(e => ({ ...e, message: e.message.replace(/^Fila \d+: /, '') }));
  const p = res.program;
  if (!p) return res;
  const name = (ai.name || '').trim().slice(0, 80) || 'Rutina importada';
  p.name = name;
  p.shortName = name.slice(0, 40);
  p.description = (ai.description || '').trim() || 'Importada con IA.';
  p.safety.warnings = (ai.precautions || []).map(w => w.trim()).filter(Boolean);
  // Filas dudosas: se marcan para revisar (por día y nombre, en orden)
  const used = new Set<string>();
  for (const r of ai.rows.filter(x => x.uncertain)) {
    for (const d of p.days) {
      const e = d.exercises.find(x => x.name === r.exercise.replace(/\s+/g, ' ').trim() && !used.has(x.key));
      if (e) { used.add(e.key); if (!res.review.includes(e.key)) res.review.push(e.key); break; }
    }
  }
  const doubtful = used.size;
  res.notes = [
    ...(ai.warnings || []).map(w => w.trim()).filter(Boolean),
    ...(doubtful ? [`La IA no estaba segura de ${doubtful === 1 ? '1 ejercicio' : `${doubtful} ejercicios`}: están marcados con "Revisar".`] : []),
    ...res.notes.filter(n => !/no hay columna "día"/i.test(n))
  ];
  return res;
}
