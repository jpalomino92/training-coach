/* ==========================================================
   Edge Function "import-routine": lee una rutina en fotos, PDF o
   texto libre con OpenAI y la devuelve como filas de planilla
   (día, ejercicio, series, reps, RIR, descanso, biserie, notas).
   La app las convierte con el mismo importador que usa para Excel
   y la persona la revisa en el editor antes de guardarla.

   - La clave de OpenAI vive solo aquí (secreto OPENAI_API_KEY).
   - Límite: AI_IMPORTS_PER_MONTH lecturas por persona y mes (2 por defecto).
     Una lectura que falla no cuenta.
   - Modelo: OPENAI_MODEL (por defecto gpt-5-mini).
   Un solo archivo para poder pegarlo en el editor del panel de Supabase.
   ========================================================== */
import { createClient } from 'npm:@supabase/supabase-js@2';

const LIMIT = Number(Deno.env.get('AI_IMPORTS_PER_MONTH') || 2);
const MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5-mini';
const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB por foto (la app las comprime antes)
const MAX_PDF_CHARS = 14_000_000; // ~10 MB
const MAX_TEXT = 20_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (error: string, status = 400) => json({ error }, status);

interface Body {
  images?: string[];
  pdf?: { name?: string; data: string };
  text?: string;
}

const ROW = {
  type: 'object',
  additionalProperties: false,
  required: ['day', 'exercise', 'sets', 'reps', 'rir', 'rest', 'group', 'notes', 'uncertain'],
  properties: {
    day: { type: 'string' },
    exercise: { type: 'string' },
    sets: { type: 'string' },
    reps: { type: 'string' },
    rir: { type: 'string' },
    rest: { type: 'string' },
    group: { type: 'string' },
    notes: { type: 'string' },
    uncertain: { type: 'boolean' }
  }
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'precautions', 'warnings', 'rows'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    precautions: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
    rows: { type: 'array', items: ROW }
  }
};

const PROMPT = `Eres un asistente que transcribe rutinas de gimnasio (fotos, PDF o texto, a veces escritas a mano) a una tabla.
Devuelve una fila por ejercicio, en el orden en que aparecen, con estos campos (texto; "" si no aparece):
- day: el día o sesión al que pertenece ("Día 1", "Lunes", "Pierna", "Sesión A"…). Repite el valor en cada fila.
- exercise: el nombre del ejercicio en español, con su nombre habitual en gimnasios (traduce del inglés). Sin series ni repeticiones.
- sets: número de series ("4"). Si dice "4x10", sets "4" y reps "10".
- reps: repeticiones como "10" o rango "8-12"; tiempo como "30s" o "5 min". En pirámides (12-10-8) usa el rango de menor a mayor ("8-12"). Si es "al fallo" o AMRAP escribe "al fallo".
- rir: "2", "1-2" o "RPE 8" tal como lo indique (RPE se escribe con la palabra RPE). "al fallo" si lo dice. "" si no aparece.
- rest: descanso como "90" (segundos), "2 min" o "1:30". "" si no aparece.
- group: la misma letra ("A", "B"…) en ejercicios SEGUIDOS que se hacen en biserie, superserie o circuito. "" si no.
- notes: indicaciones técnicas breves para ese ejercicio (tempo, pausa, "por lado", agarre). Escribe "por lado" si es unilateral.
- uncertain: true si no se lee bien o tuviste que suponer algo de esa fila.
Incluye el calentamiento, el cardio y la movilidad como ejercicios con su tiempo o repeticiones.
Ignora todo lo que no sea un ejercicio (logos, fechas, firmas, frases motivadoras).
Si hay varias semanas distintas, transcribe solo la primera y avísalo en warnings.
No inventes ejercicios ni números: si un dato no aparece, deja "".
name: un nombre corto para la rutina (máx. 40 caracteres). description: una frase sobre la rutina.
precautions: advertencias de salud o lesiones que figuren en el documento (si no hay, lista vacía).
warnings: avisos para la persona sobre lo que no se pudo leer o se supuso (en español, breves).
Si no hay ninguna rutina de ejercicios, devuelve rows vacío y explícalo en warnings.`;

/** Error con un mensaje pensado para la persona. */
class UserError extends Error {}

const isImage = (s: unknown): s is string => typeof s === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(s);

function validate(b: Body): string | null {
  const images = b.images || [];
  if (!Array.isArray(images) || images.length > MAX_IMAGES) return `Sube como mucho ${MAX_IMAGES} fotos.`;
  if (images.some(i => !isImage(i) || i.length > MAX_IMAGE_CHARS)) return 'Alguna foto no es válida o es demasiado grande.';
  if (b.pdf && (typeof b.pdf.data !== 'string' || !b.pdf.data.startsWith('data:application/pdf;base64,') || b.pdf.data.length > MAX_PDF_CHARS)) return 'El PDF no es válido o pesa más de 10 MB.';
  if (b.text != null && (typeof b.text !== 'string' || b.text.length > MAX_TEXT)) return `El texto puede tener como mucho ${MAX_TEXT} caracteres.`;
  if (!images.length && !b.pdf && !b.text?.trim()) return 'Sube una foto, un PDF o pega el texto de la rutina.';
  return null;
}

async function readWithOpenAI(b: Body, key: string) {
  const content: unknown[] = [{ type: 'text', text: b.text?.trim() ? `Texto de la rutina:\n\n${b.text.trim()}` : 'Transcribe la rutina de los archivos adjuntos.' }];
  for (const url of b.images || []) content.push({ type: 'image_url', image_url: { url, detail: 'high' } });
  if (b.pdf) content.push({ type: 'file', file: { filename: (b.pdf.name || 'rutina.pdf').slice(0, 100), file_data: b.pdf.data } });
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(130_000),
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: PROMPT }, { role: 'user', content }],
      response_format: { type: 'json_schema', json_schema: { name: 'rutina', strict: true, schema: SCHEMA } },
      ...(/^(gpt-5|o\d)/.test(MODEL) ? { reasoning_effort: 'low' } : {})
    })
  });
  if (!res.ok) {
    console.error('OpenAI', res.status, (await res.text()).slice(0, 500));
    throw new UserError(res.status === 429 ? 'El servicio de IA está saturado. Inténtalo en unos minutos.' : 'No se pudo leer la rutina con la IA. Inténtalo de nuevo.');
  }
  const out = await res.json();
  const msg = out.choices?.[0]?.message;
  if (msg?.refusal) throw new UserError('La IA no pudo procesar ese contenido.');
  return JSON.parse(msg?.content || '{}');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('Método no permitido.', 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return fail('La importación con IA no está configurada (falta OPENAI_API_KEY).', 500);

  // Quién llama: con su sesión
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return fail('Inicia sesión para importar rutinas.', 401);

  let body: Body;
  try { body = await req.json(); } catch { return fail('Petición no válida.'); }
  const invalid = validate(body);
  if (invalid) return fail(invalid);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: claim, error: claimError } = await admin.rpc('claim_ai_import', { p_user: user.id, p_limit: LIMIT });
  if (claimError) { console.error('claim', claimError.message); return fail('No se pudo comprobar tu límite de importaciones.', 500); }
  if (!claim) return fail(`Ya usaste tus ${LIMIT} importaciones con IA de este mes. Puedes importar desde Excel o CSV sin límite.`, 429);

  try {
    const routine = await readWithOpenAI(body, key);
    if (!Array.isArray(routine.rows) || !routine.rows.length) {
      await admin.rpc('release_ai_import', { p_id: claim });
      return fail(routine.warnings?.[0] || 'No se encontró ninguna rutina en lo que subiste.', 422);
    }
    const { count } = await admin.from('ai_imports').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString());
    return json({ routine, remaining: Math.max(0, LIMIT - (count ?? LIMIT)) });
  } catch (e) {
    await admin.rpc('release_ai_import', { p_id: claim });
    if (e instanceof UserError) return fail(e.message, 502);
    console.error('import', e);
    const timeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return fail(timeout ? 'La IA tardó demasiado. Prueba con menos fotos o con fotos más nítidas.' : 'No se pudo leer la rutina. Inténtalo de nuevo.', 502);
  }
});
