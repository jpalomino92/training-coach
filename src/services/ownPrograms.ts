/* ==========================================================
   Rutinas propias de cada persona (creadas, copiadas o importadas).
   Demo: localStorage. Supabase: tabla user_programs con RLS
   (migrations/2026-10-24_user_programs.sql) y copia en el dispositivo
   para poder entrenar sin conexión. Guardar y borrar necesitan conexión.
   ========================================================== */
import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_PREFIX } from '../config';
import { OWN_PREFIX, ownUuid } from '../domain/customProgram';
import type { Program } from '../domain/types';

export interface OwnPrograms {
  list(): Promise<Program[]>;
  save(p: Program): Promise<Program>;
  remove(id: string): Promise<void>;
}

const cacheKey = (userId: string) => `${STORAGE_PREFIX}:own:${userId}`;
const asOwn = (p: Program): Program => ({ ...p, custom: true, own: true, coachName: '' });

function readCache(userId: string): Program[] {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? (JSON.parse(raw) as Program[]) : [];
  } catch { return []; }
}
function writeCache(userId: string, list: Program[]) {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(list)); } catch { /* sin espacio */ }
}

/** Modo demo: todo en este dispositivo. */
export class LocalOwnPrograms implements OwnPrograms {
  constructor(private readonly userId: string) {}
  async list() { return readCache(this.userId); }
  async save(p: Program) {
    const saved = asOwn(p);
    writeCache(this.userId, [saved, ...readCache(this.userId).filter(x => x.id !== p.id)]);
    return saved;
  }
  async remove(id: string) { writeCache(this.userId, readCache(this.userId).filter(x => x.id !== id)); }
}

type Row = { id: string; data: Program };
const fromRow = (r: Row): Program => asOwn({ ...r.data, id: OWN_PREFIX + r.id });
const OFFLINE = 'Guardar rutinas necesita conexión. Inténtalo de nuevo cuando tengas internet.';

export class SupabaseOwnPrograms implements OwnPrograms {
  constructor(private readonly c: SupabaseClient, private readonly userId: string) {}

  /** Sin conexión (o sin la migración aplicada): lo último guardado en el dispositivo. */
  async list() {
    try {
      const { data, error } = await this.c.from('user_programs').select('id, data').eq('user_id', this.userId).order('updated_at', { ascending: false });
      if (error) throw error;
      const list = (data as Row[]).map(fromRow);
      writeCache(this.userId, list);
      return list;
    } catch {
      return readCache(this.userId);
    }
  }

  async save(p: Program) {
    const row = { id: ownUuid(p.id), user_id: this.userId, data: asOwn(p), updated_at: new Date().toISOString() };
    let res;
    try { res = await this.c.from('user_programs').upsert(row).select('id, data').single(); } catch { throw new Error(OFFLINE); }
    if (res.error) throw new Error(/fetch|network/i.test(res.error.message) ? OFFLINE : /máximo/.test(res.error.message) ? res.error.message : 'No se pudo guardar la rutina.');
    const saved = fromRow(res.data as Row);
    writeCache(this.userId, [saved, ...readCache(this.userId).filter(x => x.id !== saved.id)]);
    return saved;
  }

  async remove(id: string) {
    let res;
    try { res = await this.c.from('user_programs').delete().eq('id', ownUuid(id)).eq('user_id', this.userId); } catch { throw new Error(OFFLINE); }
    if (res.error) throw new Error(/fetch|network/i.test(res.error.message) ? OFFLINE : 'No se pudo eliminar la rutina.');
    writeCache(this.userId, readCache(this.userId).filter(x => x.id !== id));
  }
}
