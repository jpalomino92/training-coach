/* Calentamiento antes de la serie 1: escalera calculada y casillas para ir marcando (no se guardan). */
import { useState } from 'react';
import { loadText } from '../domain/format';
import { platesText } from '../domain/plates';
import type { Exercise } from '../domain/types';
import { warmupSets } from '../domain/warmup';

export function WarmupPanel({ ex, work, barKg }: { ex: Exercise; work: number | null; barKg?: number }) {
  const [done, setDone] = useState<number[]>([]);
  if (work == null) {
    return <p className="warmup-hint">Calentamiento: cuando elijas el peso de la serie 1, aquí verás la escalera para llegar a él.</p>;
  }
  const sets = warmupSets(ex, work, barKg);
  if (!sets.length) return null;
  return (
    <details className="warmup" open>
      <summary>Calentamiento · {sets.length} {sets.length === 1 ? 'serie' : 'series'} hasta {loadText(work, ex)}</summary>
      <ul>
        {sets.map((s, i) => (
          <li key={i}>
            <label className="check">
              <input type="checkbox" checked={done.includes(i)} onChange={e => setDone(d => (e.target.checked ? [...d, i] : d.filter(x => x !== i)))} />
              <span>
                <b>{s.barOnly ? 'Barra sola' : loadText(s.weight, ex)} × {s.reps}</b>
                {barKg != null && !s.barOnly && <span className="xs muted"> · {platesText(s.weight, barKg).replace(/ \(barra de .*$/, '')}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="xs muted">Descansa un minuto entre ellas. No se registran ni cuentan para el volumen.</p>
    </details>
  );
}
