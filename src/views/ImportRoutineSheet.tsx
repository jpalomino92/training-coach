/* Importar una rutina: desde una planilla (Excel o CSV, sin límite) o
   desde fotos, un PDF o texto pegado, que se leen con IA (2 por mes).
   Muestra qué se leyó y los errores; la rutina se revisa en el editor
   antes de guardarla. */
import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { parseCsv } from '../domain/csv';
import { importAiRoutine, importRoutine, ROUTINE_TEMPLATE, type RoutineImport } from '../domain/routineImport';
import { AI_IMPORT_LIMIT, compressImage, readAsDataUrl } from '../services/aiImport';
import { downloadText } from '../services/download';
import { useApp } from '../state/AppContext';
import { TextArea } from './coach/ExerciseEditor';

type Mode = 'sheet' | 'ai';
const MAX_BYTES = 5_000_000;
const MAX_PDF = 10_000_000;
const MAX_PHOTOS = 6;

export function ImportRoutineSheet({ onClose, onReview }: { onClose(): void; onReview(r: RoutineImport): void }) {
  const { aiImporter } = useApp();
  const [mode, setMode] = useState<Mode>('sheet');
  const [file, setFile] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [pdf, setPdf] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<RoutineImport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const aiInputId = useId();

  useEffect(() => {
    let live = true;
    aiImporter?.remaining().then(n => { if (live) setRemaining(n); });
    return () => { live = false; };
  }, [aiImporter]);

  const switchTo = (m: Mode) => { setMode(m); setResult(null); setError(''); };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setResult(null); setError('');
    if (!f) return;
    setFile(f.name);
    if (f.size > MAX_BYTES) { setError('El archivo es demasiado grande (máximo 5 MB).'); return; }
    const ext = f.name.toLowerCase().split('.').pop();
    if (ext === 'pdf' || f.type.startsWith('image/')) { setError('Para fotos y PDF usa la opción "Foto, PDF o texto".'); return; }
    if (ext === 'xls' || ext === 'ods' || ext === 'numbers') { setError('Ese formato no se puede leer. Guárdalo como Excel (.xlsx) o CSV y vuelve a intentarlo.'); return; }
    setBusy(true);
    try {
      const sheets = ext === 'xlsx'
        ? await (await import('../services/xlsx')).readXlsx(await f.arrayBuffer())
        : [{ name: f.name, rows: parseCsv(await f.text()) }];
      setResult(importRoutine(sheets, f.name));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo leer el archivo.');
    } finally { setBusy(false); }
  };

  const onAiFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    setResult(null); setError('');
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const imgs = files.filter(f => !pdfs.includes(f));
    if (pdfs.length > 1 || (pdfs.length && (imgs.length || photos.length))) { setError('Sube un PDF o varias fotos, no las dos cosas.'); return; }
    if (pdfs[0] && pdfs[0].size > MAX_PDF) { setError('El PDF pesa más de 10 MB.'); return; }
    if (pdfs[0]) { setPdf(pdfs[0]); setPhotos([]); return; }
    if (pdf && imgs.length) { setError('Sube un PDF o varias fotos, no las dos cosas.'); return; }
    const next = [...photos, ...imgs];
    if (next.length > MAX_PHOTOS) { setError(`Como mucho ${MAX_PHOTOS} fotos.`); return; }
    setPhotos(next);
  };

  const readAi = async () => {
    if (!aiImporter || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const images = await Promise.all(photos.map(compressImage));
      const pdfData = pdf ? (await readAsDataUrl(pdf)).replace(/^data:[^;]*;/, 'data:application/pdf;') : null;
      const typed = text.trim();
      const out = await aiImporter.read({ images, ...(pdfData ? { pdf: { name: pdf!.name, data: pdfData } } : {}), ...(typed ? { text: typed } : {}) });
      setRemaining(out.remaining);
      // El original queda guardado con la rutina ("Ver hoja original"): las fotos y el PDF se suben al guardarla
      const extra = typed ? { text: typed } : {};
      const source = pdfData ? { kind: 'pdf' as const, name: pdf!.name, ...extra }
        : images.length ? { kind: 'photos' as const, name: images.length === 1 ? '1 foto' : `${images.length} fotos`, ...extra }
        : { kind: 'text' as const, name: '', ...extra };
      const uploads = pdfData ? [{ name: pdf!.name, dataUrl: pdfData }] : images.map((d, i) => ({ name: `foto-${i + 1}.jpg`, dataUrl: d }));
      setResult({ ...importAiRoutine(out.routine, source), uploads });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo leer la rutina.');
      aiImporter.remaining().then(setRemaining);
    } finally { setBusy(false); }
  };

  const p = result?.program;
  const exCount = p ? p.days.reduce((n, d) => n + d.exercises.length, 0) : 0;
  const hasInput = photos.length > 0 || !!pdf || !!text.trim();
  const aiReason = !aiImporter ? 'Necesita una cuenta en la nube'
    : remaining === 0 ? 'Ya usaste las lecturas con IA de este mes'
    : !hasInput ? 'Sube fotos o un PDF, o pega el texto'
    : null;

  return (
    <Sheet title="Importar rutina" onClose={onClose}>
      <div className="seg cols-2" role="group" aria-label="Desde dónde">
        <button type="button" aria-pressed={mode === 'sheet'} onClick={() => switchTo('sheet')}>Excel o CSV</button>
        <button type="button" aria-pressed={mode === 'ai'} onClick={() => switchTo('ai')}>Foto, PDF o texto</button>
      </div>

      {mode === 'sheet' ? (
        <>
          <div className="import-help sm">
            <p>Una fila por ejercicio con las columnas <b>dia</b>, <b>ejercicio</b>, <b>series</b> y <b>reps</b> y, si quieres, <b>rir</b> (o rpe), <b>descanso</b>, <b>biserie</b> y <b>notas</b>.
              Se entiende 4x8-12, 30s, RPE 8, 2 min o 1:30. Si no hay columna de día, cada hoja del Excel es un día.</p>
            <button type="button" className="btn btn-link" onClick={() => downloadText('plantilla-rutina.csv', ROUTINE_TEMPLATE)}>
              <Icon name="download" />Descargar plantilla
            </button>
          </div>
          <div className="field">
            <label htmlFor={inputId} className="file-pick">
              <Icon name="upload" />
              <span>{file || 'Elige un archivo Excel o CSV'}</span>
            </label>
            <input id={inputId} className="sr-only" type="file" onChange={onFile}
              accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          </div>
        </>
      ) : (
        <>
          <div className="import-help sm">
            <p>Saca fotos de la rutina (aunque esté escrita a mano), sube el PDF o pega el texto. La IA la pasa a la app y tú la revisas antes de guardarla.</p>
            {aiImporter
              ? <p><b>{remaining == null ? `Hasta ${AI_IMPORT_LIMIT} lecturas con IA por mes.` : `Te quedan ${remaining} de ${AI_IMPORT_LIMIT} lecturas con IA este mes.`}</b> Si la lectura falla, no cuenta.</p>
              : <p><b>Leer con IA necesita una cuenta en la nube</b> (no está disponible en modo demo). Puedes importar desde Excel o CSV.</p>}
          </div>
          {aiImporter && (
            <>
              <div className="field">
                <label htmlFor={aiInputId} className="file-pick">
                  <Icon name="upload" />
                  <span>{pdf ? pdf.name : photos.length ? `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}: añadir más` : 'Elige fotos o un PDF'}</span>
                </label>
                <input id={aiInputId} className="sr-only" type="file" multiple accept="image/*,application/pdf,.pdf" onChange={onAiFiles} />
                {(photos.length > 0 || pdf) && (
                  <button type="button" className="btn btn-link" onClick={() => { setPhotos([]); setPdf(null); setResult(null); }}>
                    <Icon name="trash" />Quitar {pdf ? 'el PDF' : photos.length === 1 ? 'la foto' : 'las fotos'}
                  </button>
                )}
              </div>
              <TextArea label="O pega el texto de la rutina" value={text} rows={4} onChange={v => { setText(v.slice(0, 20_000)); setResult(null); }}
                placeholder={'Lunes\nSentadilla 4x8 descanso 2 min\nPrensa 3x12…'} />
            </>
          )}
        </>
      )}

      {error && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}

      {result && (
        <div className="import-result" role="status">
          {p ? (
            <>
              <p><b>Se leyeron {p.days.length} {p.days.length === 1 ? 'día' : 'días'} y {exCount} {exCount === 1 ? 'ejercicio' : 'ejercicios'}.</b></p>
              <p className="sm muted">{result.matched} de {result.total} reconocidos en el catálogo: comparten historial, dibujo y técnica con los de las otras rutinas.</p>
              {result.review.length > 0 && <p className="sm">{result.review.length === 1 ? '1 ejercicio queda marcado' : `${result.review.length} ejercicios quedan marcados`} para revisar.</p>}
            </>
          ) : <p><b>No se pudo leer la rutina.</b></p>}
          {result.errors.length > 0 && (
            <div className="import-errors">
              <p className="sm"><b>{result.errors.length} {result.errors.length === 1 ? 'fila tiene un error' : 'filas tienen errores'}{p ? ' y no se importará' + (result.errors.length === 1 ? '' : 'n') : ''}:</b></p>
              <ul className="sm">
                {result.errors.slice(0, 8).map(e => <li key={`${e.line}-${e.message}`}>{e.message}</li>)}
                {result.errors.length > 8 && <li>Y {result.errors.length - 8} más.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      {mode === 'ai' && busy && <p className="hint" role="status">Leyendo la rutina… puede tardar hasta un minuto.</p>}
      {mode === 'ai' && !p ? (
        <Button variant="primary" block loading={busy} onClick={readAi} disabledReason={aiReason} showReason>Leer con IA</Button>
      ) : (
        <Button variant="primary" block loading={busy} onClick={() => result && onReview(result)}
          disabledReason={!result ? 'Elige un archivo para ver qué se importará' : !p ? 'Corrige el archivo y vuelve a elegirlo' : null} showReason>
          Revisar y guardar
        </Button>
      )}
    </Sheet>
  );
}
