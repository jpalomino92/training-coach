/* ==========================================================
   Rutinas propias de cada persona (creadas, copiadas o importadas).
   Demo: localStorage. Supabase: tabla user_programs con RLS
   (migrations/2026-10-24_user_programs.sql) y copia en el dispositivo
   para poder entrenar sin conexión. Guardar y borrar necesitan conexión.
   Las fotos y el PDF de una rutina importada con IA van al bucket
   "routine-sources" (migrations/2026-10-27_routine_sources.sql).
   ========================================================== */
import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_PREFIX } from '../config';
import { OWN_PREFIX, ownUuid } from '../domain/customProgram';
import type { SourceUpload } from '../domain/routineImport';
import { blobFromDataUrl } from './download';
import type { Program } from '../domain/types';

export interface OwnPrograms {
  list(): Promise<Program[]>;
  save(p: Program): Promise<Program>;
  remove(id: string): Promise<void>;
  /** Sube las fotos o el PDF originales de una rutina y devuelve sus rutas ([] si no se pueden guardar). */
  uploadSource(programId: string, files: SourceUpload[]): Promise<string[]>;
  /** Enlaces temporales para ver los archivos originales. */
  sourceUrls(paths: string[]): Promise<string[]>;
}

const BUCKET = 'routine-sources';

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
  /** En este dispositivo no hay sitio para fotos: solo se guarda la planilla o el texto. */
  async uploadSource() { return []; }
  async sourceUrls() { return []; }
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

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
    const files = readCache(this.userId).find(x => x.id === id)?.source?.files || [];
    writeCache(this.userId, readCache(this.userId).filter(x => x.id !== id));
    // Los originales se borran con la rutina (si falla, quedan huérfanos pero privados)
    if (files.length) await this.c.storage.from(BUCKET).remove(files).catch(() => {});
  }

  async uploadSource(programId: string, files: SourceUpload[]) {
    const paths: string[] = [];
    try {
      for (const [i, f] of files.entries()) {
        const blob = blobFromDataUrl(f.dataUrl);
        const path = `${this.userId}/${ownUuid(programId)}/${i + 1}.${EXT[blob.type] || 'bin'}`;
        const { error } = await this.c.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
        if (error) throw error;
        paths.push(path);
      }
      return paths;
    } catch {
      // Sin el bucket (migración sin aplicar) o sin conexión: la rutina se guarda igual, sin los originales
      if (paths.length) await this.c.storage.from(BUCKET).remove(paths).catch(() => {});
      return [];
    }
  }

  async sourceUrls(paths: string[]) {
    const { data, error } = await this.c.storage.from(BUCKET).createSignedUrls(paths, 3600);
    if (error || !data) throw new Error('No se pudieron abrir los archivos originales. Revisa tu conexión.');
    return data.map(d => d.signedUrl || '');
  }
}
