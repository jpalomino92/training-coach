/* Bloque "Última sesión" (o "Primera vez"). */
import { fmtDate, fmtNum, unitSuffix, unitWord, weightRange } from '../domain/format';
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
  const sum = summarize(last.sets, ex.assisted)!;
  const unit = unitSuffix(ex);
  const word = unitWord(ex);
  const size = sum.reps.length > 5 ? ' many-2' : sum.reps.length > 3 ? ' many' : '';
  return (
    <div className={`last${size}`}>
      <span className="eyebrow">Última sesión · {fmtDate(last.workout.completed_at || last.workout.started_at)}</span>
      <div className="g">
        <div className="stat"><b>{weightRange(sum.weights, ex)}</b><span>{ex.assisted ? 'Asistencia' : 'Peso'}</span></div>
        <div className="stat"><b>{sum.reps.join(' / ')}{unit}</b><span>{word[0].toUpperCase() + word.slice(1)}</span></div>
        <div className="stat"><b>{sum.finalRir == null ? '—' : fmtNum(sum.finalRir)}</b><span>RIR final</span></div>
      </div>
    </div>
  );
}
