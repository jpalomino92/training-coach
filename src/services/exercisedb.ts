/* Búsqueda en ExerciseDB (versión gratuita, oss.exercisedb.dev).
   Solo se usa en el editor del entrenador; al añadir un ejercicio sus datos
   se copian en la rutina, así la app del alumno no depende de esta API. */
import type { ExerciseDbItem } from '../domain/customProgram';

const BASE = 'https://oss.exercisedb.dev/api/v1';

export interface SearchResult { items: ExerciseDbItem[]; total: number }

const cache = new Map<string, SearchResult>();

export async function searchExercises(name: string, signal?: AbortSignal, limit = 20): Promise<SearchResult> {
  const q = name.trim().toLowerCase();
  if (q.length < 2) return { items: [], total: 0 };
  const key = `${q}|${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let res: Response;
  try {
    res = await fetch(`${BASE}/exercises?name=${encodeURIComponent(q)}&limit=${limit}`, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('No se pudo conectar con ExerciseDB. Revisa la conexión e inténtalo de nuevo.', { cause: e });
  }
  if (res.status === 429) throw new Error('ExerciseDB está limitando las búsquedas. Espera un minuto e inténtalo de nuevo.');
  if (!res.ok) throw new Error(`ExerciseDB no responde (${res.status}). Inténtalo más tarde.`);
  const body = await res.json() as { data?: ExerciseDbItem[]; meta?: { total?: number } };
  const out = { items: body.data || [], total: body.meta?.total ?? (body.data || []).length };
  cache.set(key, out);
  return out;
}
