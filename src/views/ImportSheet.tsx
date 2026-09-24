/* Importar CSV: peso corporal o historial de ejercicios.
   Vista previa con los errores por línea antes de guardar nada. */
import { useId, useState, type ChangeEvent } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { BODY_WEIGHT_TEMPLATE, exerciseTemplate, importBodyWeights, importExerciseSets, type BodyWeightImport, type ExerciseImport } from '../domain/csv';
import { downloadText } from '../services/download';
import { useApp } from '../state/AppContext';

type Kind = 'bw' | 'ex';
const MAX_BYTES = 2_000_000;

export function ImportSheet({ onClose }: { onClose(): void }) {
  const { data, program, importBodyWeights: saveBw, importWorkouts, showToast } = useApp();
  const [kind, setKind] = useState<Kind>('bw');
  const [file, setFile] = useState('');
  const [result, setResult] = useState<BodyWeightImport | ExerciseImport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputId = useId();

  const reset = (k: Kind) => { setKind(k); setFile(''); setResult(null); setError(''); };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setResult(null); setError('');
    if (!f) return;
    if (f.size > MAX_BYTES) { setError('El archivo es demasiado grande (máximo 2 MB).'); return; }
    const text = await f.text();
    setFile(f.name);
    setResult(kind === 'bw' ? importBodyWeights(text, data) : importExerciseSets(text, program, data));
  };

  const count = !result ? 0 : 'rows' in result ? result.rows.length : result.setCount;

  const save = async () => {
    if (!result || !count || busy) return;
    setBusy(true);
    try {
      const n = 'rows' in result ? await saveBw(result.rows) : await importWorkouts(result.workouts);
      showToast(`${n} ${n === 1 ? 'registro importado' : 'registros importados'}.`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar.');
      setBusy(false);
    }
  };

  return (
    <Sheet title="Importar CSV" onClose={onClose}>
      <div className="view" role="group" aria-label="Qué importar">
        <button type="button" aria-pressed={kind === 'bw'} onClick={() => reset('bw')}>Peso corporal</button>
        <button type="button" aria-pressed={kind === 'ex'} onClick={() => reset('ex')}>Ejercicios</button>
      </div>

      <div className="import-help sm">
        {kind === 'bw' ? (
          <p>Columnas: <b>fecha</b>, <b>peso_kg</b> y, si quieres, <b>nota</b>. Fechas como 21/09/2026 o 2026-09-21; decimales con coma o punto.</p>
        ) : (
          <p>Columnas: <b>fecha</b>, <b>ejercicio</b>, <b>reps</b> (o segundos) y, si quieres, <b>serie</b>, <b>peso_kg</b> y <b>rir</b>. Los ejercicios tienen que llamarse como en tu rutina ({program.shortName}). Cada fecha se guarda como un entrenamiento completado.</p>
        )}
        <button type="button" className="btn btn-link" onClick={() => downloadText(kind === 'bw' ? 'plantilla-peso-corporal.csv' : 'plantilla-ejercicios.csv', kind === 'bw' ? BODY_WEIGHT_TEMPLATE : exerciseTemplate(program))}>
          <Icon name="download" />Descargar plantilla
        </button>
      </div>

      <div className="field">
        <label htmlFor={inputId} className="file-pick">
          <Icon name="upload" />
          <span>{file || 'Elige un archivo CSV'}</span>
        </label>
        <input id={inputId} className="sr-only" type="file" accept=".csv,text/csv,text/plain" onChange={onFile} />
      </div>

      {error && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}

      {result && (
        <div className="import-result" role="status">
          <p><b>{count ? `Se importarán ${count} ${count === 1 ? 'registro' : 'registros'}` : 'No hay registros nuevos para importar'}</b>
            {'workouts' in result && result.workouts.length > 0 && ` en ${result.workouts.length} ${result.workouts.length === 1 ? 'entrenamiento' : 'entrenamientos'}`}.</p>
          {result.skipped > 0 && <p className="sm muted">{result.skipped} {result.skipped === 1 ? 'fila ya estaba registrada' : 'filas ya estaban registradas'} y se omiten.</p>}
          {result.errors.length > 0 && (
            <div className="import-errors">
              <p className="sm"><b>{result.errors.length} {result.errors.length === 1 ? 'fila tiene un error' : 'filas tienen errores'} y no se importarán:</b></p>
              <ul className="sm">
                {result.errors.slice(0, 8).map(e => <li key={`${e.line}-${e.message}`}>Línea {e.line}: {e.message}</li>)}
                {result.errors.length > 8 && <li>Y {result.errors.length - 8} más.</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button variant="primary" block onClick={save} loading={busy}
        disabledReason={!result ? 'Elige un archivo para ver qué se importará' : !count ? 'No hay registros para importar' : null} showReason>
        {count ? `Importar ${count} ${count === 1 ? 'registro' : 'registros'}` : 'Importar'}
      </Button>
    </Sheet>
  );
}
