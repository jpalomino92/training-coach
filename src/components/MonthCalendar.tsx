/* Calendario mensual del Historial: los días entrenados llevan el color del día de la rutina.
   Tocar un día abre su entrenamiento en la lista. */
import { useState } from 'react';
import { localDate } from '../domain/format';
import type { ProgramLookup, Workout } from '../domain/types';
import { Icon } from './Icon';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const HEAD = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function MonthCalendar({ workouts, lookup, onPick }: { workouts: Workout[]; lookup: ProgramLookup; onPick(id: string): void }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDate = new Map<string, Workout[]>();
  for (const w of workouts) {
    const k = localDate(new Date(w.completed_at || w.started_at));
    byDate.set(k, [...(byDate.get(k) || []), w]);
  }
  const y = month.getFullYear(), m = month.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = localDate();
  const inMonth = [...byDate.entries()].filter(([k]) => k.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).reduce((n, [, l]) => n + l.length, 0);
  const title = `${MONTHS[m][0].toUpperCase()}${MONTHS[m].slice(1)} ${y}`;
  const now = new Date();
  const isCurrent = y === now.getFullYear() && m === now.getMonth();

  return (
    <section className="card calendar" aria-label={`Calendario: ${title}`}>
      <div className="cal-hd">
        <button type="button" className="step" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label="Mes anterior"><Icon name="chevL" /></button>
        <div className="tx">
          <h2 className="h3" id="cal-t" aria-live="polite">{title}</h2>
          <span className="sm muted">{inMonth} {inMonth === 1 ? 'entrenamiento' : 'entrenamientos'}</span>
        </div>
        {/* Deshabilitado con aria-disabled: sigue siendo enfocable (HANDOFF) */}
        <button type="button" className="step" onClick={() => { if (!isCurrent) setMonth(new Date(y, m + 1, 1)); }} aria-label="Mes siguiente"
          aria-disabled={isCurrent || undefined}><Icon name="chevR" /></button>
      </div>
      <table className="cal-grid">
        <thead><tr>{HEAD.map((h, i) => <th key={h + i} scope="col" abbr={WEEKDAYS[i]}>{h}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, r) => (
            <tr key={r}>
              {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
                if (!d) return <td key={c} />;
                const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const list = byDate.get(key) || [];
                const w = list[0];
                const day = w ? lookup(w.program_id)?.days.find(x => x.id === w.day_id) : undefined;
                const label = `${WEEKDAYS[c]} ${d} de ${MONTHS[m]}${list.length ? `: ${list.map(x => {
                  const dd = lookup(x.program_id)?.days.find(z => z.id === x.day_id);
                  return `${dd ? dd.name : x.day_id}${x.status === 'completed' ? '' : ' (en progreso)'}`;
                }).join(', ')}` : ''}`;
                return (
                  <td key={c} className={key === today ? 'today' : ''}>
                    {w ? (
                      <button type="button" className={`cal-day on dc-${day?.color || 'black'}`} onClick={() => onPick(w.id)} aria-label={label}>
                        <span aria-hidden="true">{d}</span>
                        {list.length > 1 && <i aria-hidden="true">{list.length}</i>}
                      </button>
                    ) : (
                      <span className="cal-day"><span aria-hidden="true">{d}</span><span className="sr-only">{label}</span></span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
