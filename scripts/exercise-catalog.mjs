/* Genera src/data/exercise-catalog.json con el texto de los 1.324 ejercicios
   de ExerciseDB v1 (vía hasaneyldrm/exercises-dataset, licencia MIT).
   Solo nombre, equipo, músculos e instrucciones en español: las imágenes y
   los GIF del dataset son de Gym visual y NO se pueden usar (ver NOTICE.md).
   Uso: node scripts/exercise-catalog.mjs */
import { writeFile } from 'node:fs/promises';

// Versión fija del dataset: si cambia el original, lo nuestro no se rompe
const COMMIT = '7455efae41b330c265e7cd4b78dfa848e7ce5ebd';
const URL = `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/${COMMIT}/data/exercises.json`;
const OUT = new globalThis.URL('../src/data/exercise-catalog.json', import.meta.url);

// Máquinas de cardio y material raro: la app ya añade el cardio final
const SKIP_EQUIPMENT = new Set(['hammer', 'tire', 'skierg machine', 'upper body ergometer', 'stationary bike', 'elliptical machine', 'stepmill machine']);

const res = await fetch(URL);
if (!res.ok) throw new Error(`No se pudo bajar el dataset (${res.status})`);
const data = await res.json();

const seen = new Set();
const items = [];
for (const e of data) {
  const name = e.name.trim().toLowerCase();
  if (SKIP_EQUIPMENT.has(e.equipment) || seen.has(name)) continue;
  seen.add(name);
  items.push({
    id: e.media_id,
    name,
    eq: e.equipment,
    part: e.body_part,
    target: e.target,
    sec: e.secondary_muscles,
    steps: (e.instruction_steps?.es || []).map(s => s.trim()).filter(Boolean)
  });
}
items.sort((a, b) => a.name.localeCompare(b.name));

await writeFile(OUT, JSON.stringify({
  source: `ExerciseDB v1 (AscendAPI) vía https://github.com/hasaneyldrm/exercises-dataset (commit ${COMMIT}), licencia MIT. Solo texto: sin imágenes ni animaciones.`,
  items
}) + '\n');
console.log(`${items.length} ejercicios → src/data/exercise-catalog.json`);
