/* ==========================================================
   Importar y exportar CSV: peso corporal e historial de ejercicios.
   Acepta ',' ';' o tabulador, comillas, coma decimal y fechas
   aaaa-mm-dd, dd/mm/aaaa o dd-mm-aaaa. Exporta con ';' y coma decimal
   (lo que abre bien Excel en español).
   ========================================================== */
import { fmtNum, localDate, parseNum } from './format';
import { altExercise, baseKey, resolveExercise } from './alternatives';
import { builtinLookup, programList } from './routines';
import type { BodyWeightInput, Exercise, Program, ProgramLookup, UserData } from './types';

export interface CsvError { line: number; message: string }

/* ---------- Lectura ---------- */

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/).find(l => l.trim()) || '';
  const sep = [';', '\t', ','].map(c => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(c => c.trim()));
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Fecha en formato local aaaa-mm-dd, o null si no es válida. */
export function parseDate(s: string): string | null {
  const t = s.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/.exec(t);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(t))) { d = +r[1]; m = +r[2]; y = +r[3] < 100 ? 2000 + +r[3] : +r[3]; }
  else return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d || y < 1990) return null;
  return localDate(dt);
}

function columns<A extends Record<string, string[]>>(header: string[], aliases: A, required: (keyof A)[]): Record<keyof A, number> | string {
  const h = header.map(norm);
  const out = {} as Record<keyof A, number>;
  for (const key of Object.keys(aliases) as (keyof A)[]) out[key] = h.findIndex(c => aliases[key].includes(c));
  const missing = required.filter(k => out[k] < 0);
  return missing.length ? `Falta la columna ${missing.map(k => `"${aliases[k][0]}"`).join(' y ')} en la primera fila.` : out;
}

/* ---------- Peso corporal ---------- */

const BW_COLS = { date: ['fecha', 'date', 'dia'], weight: ['peso', 'peso kg', 'kg', 'weight', 'peso corporal'], note: ['nota', 'notas', 'note', 'comentario'] };

export interface BodyWeightImport { rows: BodyWeightInput[]; errors: CsvError[]; skipped: number }

export function importBodyWeights(text: string, data: Pick<UserData, 'bodyWeights'>, today = localDate()): BodyWeightImport {
  const rows = parseCsv(text).filter(r => r.some(c => c));
  const res: BodyWeightImport = { rows: [], errors: [], skipped: 0 };
  if (!rows.length) { res.errors.push({ line: 1, message: 'El archivo está vacío.' }); return res; }
  const cols = columns(rows[0], BW_COLS, ['date', 'weight']);
  if (typeof cols === 'string') { res.errors.push({ line: 1, message: cols }); return res; }
  const seen = new Set(data.bodyWeights.map(b => `${b.date}|${b.weight_kg}`));
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const date = parseDate(r[cols.date] || '');
    const kg = parseNum(r[cols.weight] || '');
    if (!date) return res.errors.push({ line, message: `Fecha no válida: "${r[cols.date] || ''}". Usa dd/mm/aaaa o aaaa-mm-dd.` });
    if (date > today) return res.errors.push({ line, message: 'La fecha es posterior a hoy.' });
    if (kg == null || Number.isNaN(kg) || kg <= 20 || kg >= 400) return res.errors.push({ line, message: `Peso no válido: "${r[cols.weight] || ''}".` });
    const weight_kg = Math.round(kg * 10) / 10;
    const key = `${date}|${weight_kg}`;
    if (seen.has(key)) { res.skipped++; return; }
    seen.add(key);
    res.rows.push({ date, weight_kg, note: cols.note >= 0 ? (r[cols.note] || '').slice(0, 500) : '' });
  });
  return res;
}

/* ---------- Historial de ejercicios ---------- */

const EX_COLS = {
  date: ['fecha', 'date', 'dia'],
  exercise: ['ejercicio', 'exercise', 'nombre'],
  set: ['serie', 'set', 'n serie', 'numero de serie'],
  weight: ['peso', 'peso kg', 'kg', 'weight'],
  reps: ['reps', 'repeticiones', 'rep', 'segundos', 'seg', 'tiempo'],
  rir: ['rir']
};

export interface ImportedSet { exercise: Exercise; set_index: number; weight: number | null; reps: number; rir: number | null }
export interface ImportedWorkout { date: string; dayId: string; sets: ImportedSet[] }
export interface ExerciseImport { workouts: ImportedWorkout[]; setCount: number; errors: CsvError[]; skipped: number }

/** Busca el ejercicio en la rutina por nombre o por clave, sin tener en cuenta tildes ni mayúsculas.
    Si no está, busca entre las alternativas de la rutina (se guarda como alternativa). */
export function findByName(program: Program, name: string): Exercise | null {
  const n = norm(name);
  for (const d of program.days) for (const e of d.exercises) if (norm(e.name) === n || norm(e.key) === n) return e;
  for (const d of program.days) for (const e of d.exercises) if (norm(e.alt) === n) return altExercise(e);
  return null;
}

export function importExerciseSets(text: string, program: Program, data: Pick<UserData, 'workouts' | 'sets'>, today = localDate()): ExerciseImport {
  const rows = parseCsv(text).filter(r => r.some(c => c));
  const res: ExerciseImport = { workouts: [], setCount: 0, errors: [], skipped: 0 };
  if (!rows.length) { res.errors.push({ line: 1, message: 'El archivo está vacío.' }); return res; }
  const cols = columns(rows[0], EX_COLS, ['date', 'exercise', 'reps']);
  if (typeof cols === 'string') { res.errors.push({ line: 1, message: cols }); return res; }

  // Series ya registradas: fecha|ejercicio|serie
  const existing = new Set<string>();
  for (const w of data.workouts.filter(x => x.program_id === program.id)) {
    const date = localDate(new Date(w.completed_at || w.started_at));
    for (const s of data.sets.filter(x => x.workout_id === w.id)) existing.add(`${date}|${s.exercise_key}|${s.set_index}`);
  }

  const byDate = new Map<string, ImportedSet[]>();
  const nextIndex = new Map<string, number>();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const date = parseDate(r[cols.date] || '');
    if (!date) return res.errors.push({ line, message: `Fecha no válida: "${r[cols.date] || ''}". Usa dd/mm/aaaa o aaaa-mm-dd.` });
    if (date > today) return res.errors.push({ line, message: 'La fecha es posterior a hoy.' });
    const ex = findByName(program, r[cols.exercise] || '');
    if (!ex) {
      const other = programList().find(p => p.id !== program.id && findByName(p, r[cols.exercise] || ''));
      return res.errors.push({ line, message: other ? `"${r[cols.exercise]}" es de otra rutina (${other.shortName}); solo se importan ejercicios de tu rutina actual.` : `Ejercicio no encontrado en tu rutina: "${r[cols.exercise] || ''}".` });
    }
    const maxReps = ex.unit === 's' ? 600 : 50;
    const reps = parseNum(r[cols.reps] || '');
    if (reps == null || Number.isNaN(reps) || !Number.isInteger(reps) || reps < 1 || reps > maxReps) return res.errors.push({ line, message: `${ex.unit === 's' ? 'Segundos' : 'Repeticiones'} no válidas: "${r[cols.reps] || ''}" (entre 1 y ${maxReps}).` });
    const weight = cols.weight >= 0 ? parseNum(r[cols.weight] || '') : null;
    if (weight != null && (Number.isNaN(weight) || weight < 0 || weight > 500)) return res.errors.push({ line, message: `Peso no válido: "${r[cols.weight]}" (entre 0 y 500).` });
    const rir = cols.rir >= 0 ? parseNum(r[cols.rir] || '') : null;
    if (rir != null && (Number.isNaN(rir) || rir < 0 || rir > 5)) return res.errors.push({ line, message: `RIR no válido: "${r[cols.rir]}" (entre 0 y 5).` });
    const k = `${date}|${ex.key}`;
    let idx: number;
    if (cols.set >= 0 && r[cols.set]) {
      const n = parseNum(r[cols.set]);
      if (n == null || Number.isNaN(n) || !Number.isInteger(n) || n < 1 || n > 20) return res.errors.push({ line, message: `Número de serie no válido: "${r[cols.set]}".` });
      idx = n - 1;
    } else idx = nextIndex.get(k) ?? 0;
    nextIndex.set(k, Math.max(nextIndex.get(k) ?? 0, idx + 1));
    const list = byDate.get(date) || [];
    if (existing.has(`${k}|${idx}`) || list.some(s => s.exercise.key === ex.key && s.set_index === idx)) { res.skipped++; return; }
    list.push({ exercise: ex, set_index: idx, weight: weight || weight === 0 ? weight : null, reps, rir });
    byDate.set(date, list);
  });

  for (const [date, sets] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // El día de la rutina con más ejercicios del grupo
    const day = [...program.days].sort((a, b) =>
      sets.filter(s => b.exercises.some(e => e.key === baseKey(s.exercise.key))).length - sets.filter(s => a.exercises.some(e => e.key === baseKey(s.exercise.key))).length)[0];
    res.workouts.push({ date, dayId: day.id, sets });
    res.setCount += sets.length;
  }
  return res;
}

/* ---------- Exportar ---------- */

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : typeof v === 'number' ? fmtNum(v) : v;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: (string | number | null | undefined)[][]) => '\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';

export function exportBodyWeightsCsv(data: Pick<UserData, 'bodyWeights'>): string {
  const rows = data.bodyWeights.slice().sort((a, b) => a.date.localeCompare(b.date)).map(b => [b.date, b.weight_kg, b.note]);
  return toCsv([['fecha', 'peso_kg', 'nota'], ...rows]);
}

export function exportSetsCsv(data: Pick<UserData, 'workouts' | 'sets'>, lookup: ProgramLookup = builtinLookup): string {
  const rows: (string | number | null)[][] = [];
  const workouts = data.workouts.slice().sort((a, b) => +new Date(a.completed_at || a.started_at) - +new Date(b.completed_at || b.started_at));
  for (const w of workouts) {
    const program = lookup(w.program_id);
    const day = program?.days.find(d => d.id === w.day_id);
    const date = localDate(new Date(w.completed_at || w.started_at));
    const sets = data.sets.filter(s => s.workout_id === w.id).sort((a, b) => a.exercise_key.localeCompare(b.exercise_key) || a.set_index - b.set_index);
    for (const s of sets) {
      const ex = resolveExercise(program, s.exercise_key);
      rows.push([date, ex?.name || s.exercise_key, s.set_index + 1, s.weight, s.reps, s.rir, program?.shortName || w.program_id, day?.name || w.day_id]);
    }
  }
  return toCsv([['fecha', 'ejercicio', 'serie', 'peso_kg', 'reps', 'rir', 'rutina', 'dia'], ...rows]);
}

export const BODY_WEIGHT_TEMPLATE = toCsv([['fecha', 'peso_kg', 'nota'], ['01/09/2026', 78.4, 'En ayunas'], ['08/09/2026', 77.9, '']]);

export function exerciseTemplate(program: Program): string {
  const [a, b] = program.days[0].exercises;
  return toCsv([
    ['fecha', 'ejercicio', 'serie', 'peso_kg', 'reps', 'rir'],
    ['01/09/2026', a.name, 1, 40, 10, 2],
    ['01/09/2026', a.name, 2, 40, 9, 2],
    ['01/09/2026', b.name, 1, 20, 12, 2]
  ]);
}
