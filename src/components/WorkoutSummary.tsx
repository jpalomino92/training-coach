/* Resumen al terminar el entrenamiento y nota del día. */
import { useEffect, useId, useRef, useState } from 'react';
import { fmtDate } from '../domain/format';
import { fmtMinutes, fmtThousands, workoutSummary } from '../domain/summary';
import type { Workout } from '../domain/types';
import { useApp } from '../state/AppContext';
import { Icon } from './Icon';

export function WorkoutSummaryCard({ workout, onHistory }: { workout: Workout; onHistory?(): void }) {
  const { data, lookup } = useApp();
  const s = workoutSummary(data, workout, lookup);
  const diff = s.previous && s.previous.volume > 0 && s.volume > 0 ? Math.round(((s.volume - s.previous.volume) / s.previous.volume) * 100) : null;
  return (
    <section className="card summary" aria-labelledby="sum-t">
      <h2 className="done-head" id="sum-t"><Icon name="check" />Entrenamiento completado el {fmtDate(workout.completed_at)}</h2>
      <dl className="sum-grid">
        <div><dt>Duración</dt><dd>{s.minutes != null ? fmtMinutes(s.minutes) : '—'}</dd></div>
        <div><dt>Series</dt><dd>{s.sets} de {s.total}</dd></div>
        <div><dt>Volumen</dt><dd>{s.volume > 0 ? `${fmtThousands(s.volume)} kg` : '—'}</dd></div>
      </dl>
      {s.previous && (
        <p className="sm">
          La sesión anterior de este día ({fmtDate(s.previous.date)}): {s.previous.sets} series
          {s.previous.volume > 0 && <> y {fmtThousands(s.previous.volume)} kg</>}
          {diff != null && <> · volumen {diff > 0 ? `+${diff}` : diff} %</>}.
        </p>
      )}
      {s.records.length > 0 && (
        <p className="sum-pr"><Icon name="trophy" /><span><b>{s.records.length === 1 ? 'Récord' : `${s.records.length} récords`}:</b> {s.records.map(r => r.name).join(', ')}.</span></p>
      )}
      {s.pain.length > 0 && (
        <p className="sum-pain"><Icon name="alert" /><span>Marcaste dolor en {s.pain.join(', ')}. Si continúa, coméntalo con tu profesional sanitario antes de volver a hacerlo.</span></p>
      )}
      <p className="sm muted">Puedes seguir editando las series si lo necesitas.</p>
      {onHistory && <button type="button" className="btn btn-link" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={onHistory}>Ver en historial</button>}
    </section>
  );
}

/** Nota del entrenamiento del día; se guarda sola. */
export function WorkoutNote({ workout }: { workout: Workout }) {
  const { saveWorkoutNote, showToast } = useApp();
  const [text, setText] = useState(workout.notes || '');
  const saved = useRef(workout.notes || '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  const flush = (v: string) => {
    clearTimeout(timer.current);
    if (v === saved.current) return;
    saved.current = v;
    saveWorkoutNote(workout.id, v).catch(e => showToast(e instanceof Error ? e.message : 'No se pudo guardar la nota.'));
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const textRef = useRef(text);
  textRef.current = text;
  useEffect(() => () => flushRef.current(textRef.current), []);

  return (
    <div className="field workout-note">
      <label htmlFor={id} className="eyebrow">Nota del entrenamiento</label>
      <textarea id={id} className="inp" rows={2} maxLength={1000} value={text} placeholder="Ej.: dormí mal, el gimnasio estaba lleno…"
        aria-describedby={`${id}-h`}
        onChange={e => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => flush(v), 800); }}
        onBlur={() => flush(text)} />
      <p id={`${id}-h`} className="note-hint">Se guarda sola. La verás en el historial.</p>
    </div>
  );
}
