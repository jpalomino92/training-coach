/* ==========================================================
   Importar una rutina con IA (solo modo Supabase): las fotos, el PDF
   o el texto van a la Edge Function "import-routine", que los lee con
   OpenAI y devuelve filas de planilla. La clave de OpenAI nunca está
   en la app. Límite de AI_IMPORT_LIMIT lecturas por persona y mes.
   ========================================================== */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiRoutine } from '../domain/routineImport';

export const AI_IMPORT_LIMIT = 2;

export interface AiImportInput {
  /** Fotos ya comprimidas, como data URL (image/jpeg). */
  images: string[];
  pdf?: { name: string; data: string };
  text?: string;
}

export interface AiImporter {
  /** Lecturas que quedan este mes, o null si no se pudo saber (sin conexión). */
  remaining(): Promise<number | null>;
  read(input: AiImportInput): Promise<{ routine: AiRoutine; remaining: number }>;
}

const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };

export class SupabaseAiImporter implements AiImporter {
  constructor(private readonly c: SupabaseClient, private readonly userId: string) {}

  async remaining() {
    try {
      const { count, error } = await this.c.from('ai_imports').select('id', { count: 'exact', head: true })
        .eq('user_id', this.userId).gte('created_at', monthStart());
      if (error) return null;
      return Math.max(0, AI_IMPORT_LIMIT - (count ?? 0));
    } catch { return null; }
  }

  async read(input: AiImportInput) {
    const { data, error } = await this.c.functions.invoke('import-routine', { body: input });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        if (ctx.status === 404) throw new Error('La importación con IA todavía no está activada en el servidor.');
        const body = await ctx.json().catch(() => null) as { error?: string } | null;
        if (body?.error) throw new Error(body.error);
      }
      throw new Error(error.name === 'FunctionsFetchError'
        ? 'Leer con IA necesita conexión. Inténtalo de nuevo cuando tengas internet.'
        : 'No se pudo leer la rutina. Inténtalo de nuevo.');
    }
    return data as { routine: AiRoutine; remaining: number };
  }
}

/* ---------- Archivos ---------- */

const MAX_SIDE = 1800;

/** Foto lista para enviar: JPEG de como mucho 1800 px de lado (suficiente para leer letra a mano). */
export async function compressImage(file: File): Promise<string> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch {
    throw new Error(`No se pudo abrir "${file.name}". Usa fotos JPG o PNG (en iPhone: Ajustes › Cámara › Formatos › Más compatible).`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error(`No se pudo leer "${file.name}".`));
    r.readAsDataURL(file);
  });
}
