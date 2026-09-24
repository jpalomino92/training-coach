/* Bloque "Última sesión" (o "Primera vez"). */
import { fmtDate, fmtNum, weightRange } from '../domain/format';
import { summarize } from '../domain/progression';
import type { Exercise } from '../domain/types';
import type { LastSession as Last } from '../domain/workout';

export function LastSession({ ex, last, firstHint }: { ex: Exercise; last: Last | null; firstHint: string }) {
  if (!last) {
    return (
      <div className="first">
        <span className="eyebrow">Primera vez</span>
        <p>Aún no hay registros de este ejercicio. {firstHint}</p>
      </div>
    );
  }
  const sum = summarize(last.sets)!;
  const unit = ex.unit === 's' ? ' s' : '';
  const size = sum.reps.length > 5 ? ' many-2' : sum.reps.length > 3 ? ' many' : '';
  return (
    <div className={`last${size}`}>
      <span className="eyebrow">Última sesión · {fmtDate(last.workout.completed_at || last.workout.started_at)}</span>
      <div className="g">
        <div className="stat"><b>{weightRange(sum.weights)}</b><span>Peso</span></div>
        <div className="stat"><b>{sum.reps.join(' / ')}{unit}</b><span>{ex.unit === 's' ? 'Segundos' : 'Repeticiones'}</span></div>
        <div className="stat"><b>{sum.finalRir == null ? '—' : fmtNum(sum.finalRir)}</b><span>RIR final</span></div>
      </div>
    </div>
  );
}
