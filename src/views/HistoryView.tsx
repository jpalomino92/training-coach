/* HISTORIAL: entrenamientos agrupados por mes. El borrado se confirma dentro
   de la propia tarjeta, con el foco en "Cancelar". */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DiscBadge } from '../components/DayDisc';
import { ExerciseIllustration } from '../components/ExerciseIllustration';
import { Icon } from '../components/Icon';
import { fmtMonthYear, fmtNum, fmtWeekdayShort, weightRange } from '../domain/format';
import { findExercise, findExerciseAnywhere, routinePrograms } from '../domain/routines';
import type { Workout, WorkoutSet } from '../domain/types';
import { recordSetIds } from '../domain/records';
import { byStartDesc, setsOf, totalSets } from '../domain/workout';
import { useApp } from '../state/AppContext';

/** Series que fueron récord personal en su momento, por rutina y ejercicio. */
function allRecordIds(workouts: Workout[], sets: WorkoutSet[]): Set<string> {
  const out = new Set<string>();
  const when = new Map(workouts.map(w => [w.id, +new Date(w.completed_at || w.started_at)]));
  const program = new Map(workouts.map(w => [w.id, w.program_id]));
  const groups = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const k = `${program.get(s.workout_id)}|${s.exercise_key}`;
    groups.set(k, [...(groups.get(k) || []), s]);
  }
  for (const [k, list] of groups) {
    const [pid, key] = k.split('|');
    const ex = (routinePrograms[pid] && findExercise(routinePrograms[pid], key)) || findExerciseAnywhere(key);
    if (!ex) continue;
    list.sort((a, b) => (when.get(a.workout_id)! - when.get(b.workout_id)!) || a.set_index - b.set_index);
    recordSetIds(ex, list).forEach(id => out.add(id));
  }
  return out;
}

function HistoryCard({ w, sets, open, onToggle, records }: { w: Workout; sets: WorkoutSet[]; open: boolean; onToggle(): void; records: Set<string> }) {
  const { deleteWorkout, showToast, program: current } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirm) cancelRef.current?.focus(); }, [confirm]);

  const pr = routinePrograms[w.program_id];
  const day = pr?.days.find(d => d.id === w.day_id);
  const total = day ? totalSets(day) : sets.length;
  const dateIso = w.completed_at || w.started_at;
  const title = `${fmtWeekdayShort(dateIso)} · ${day ? `${day.name} — ${day.focus}` : w.day_id}`;
  const statusText = w.status === 'completed'
    ? (sets.length >= total ? `✓ Completado · ${sets.length} series` : `◐ Terminado con ${sets.length} de ${total} series`)
    : `◐ En progreso · ${sets.length} de ${total} series`;
  const keys = [...new Set(sets.map(s => s.exercise_key))];
  const order = (k: string) => day?.exercises.findIndex(e => e.key === k) ?? 0;
  keys.sort((a, b) => order(a) - order(b));

  const remove = async () => {
    setBusy(true);
    try { await deleteWorkout(w.id); showToast('Entrenamiento eliminado'); }
    catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo eliminar.'); setBusy(false); }
  };

  return (
    <section className={`card hcard${open ? ' open' : ''}`} data-day={day?.color || 'black'}>
      <button type="button" className="drow" aria-expanded={open} aria-controls={`h-${w.id}`} onClick={onToggle}>
        {day ? <DiscBadge day={day} size={40} /> : <span className="disc dc-black" style={{ width: 40, height: 40 }} aria-hidden="true" />}
        <span className="tx">
          <span className="t">{title}</span>
          <span className="s">{pr && pr.id !== current.id ? `${pr.shortName} · ` : ''}{statusText}</span>
        </span>
        <Icon name={open ? 'chevU' : 'chevD'} />
      </button>
      {open && (
        <div id={`h-${w.id}`} className="stack-sm">
          <ul className="hl">
            {keys.map(k => {
              const ex = (pr && findExercise(pr, k)) || findExerciseAnywhere(k);
              const ss = sets.filter(s => s.exercise_key === k).sort((a, b) => a.set_index - b.set_index);
              const unit = ex?.unit === 's' ? ' s' : '';
              const weights = ss.map(s => s.weight || 0);
              const lastRir = [...ss].reverse().find(s => s.rir != null)?.rir;
              const line = [
                `${weights.some(x => x > 0) ? `${weightRange(weights)} × ` : ''}${ss.map(s => s.reps).join(' / ')}${unit}${ex?.perSide ? ' por lado' : ''}`,
                lastRir != null ? `RIR ${fmtNum(lastRir)}` : ''
              ].filter(Boolean).join(' · ');
              return (
                <li key={k}>
                  <b>{ex?.name || k}</b>
                  <span>{line}</span>
                  {ss.some(x => records.has(x.id)) && <span className="pr-mark"><Icon name="trophy" />Récord personal</span>}
                  {w.feel?.[k] === 'pain' && <span className="pain-mark">Marcado con dolor articular, de espalda o neurológico.</span>}
                </li>
              );
            })}
            {!keys.length && <li><span>Sin series registradas.</span></li>}
          </ul>
          {confirm ? (
            <div className="confirm" role="alertdialog" aria-labelledby={`del-${w.id}`}>
              <p id={`del-${w.id}`}><b>¿Eliminar este entrenamiento? No se puede deshacer.</b></p>
              <div className="btn-row">
                <Button ref={cancelRef} variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
                <Button variant="danger" onClick={remove} loading={busy}>Eliminar</Button>
              </div>
            </div>
          ) : (
            <Button variant="link" className="danger" icon="trash" onClick={() => setConfirm(true)} style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>Eliminar entrenamiento</Button>
          )}
        </div>
      )}
    </section>
  );
}

export function HistoryView() {
  const { data, setTab } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const list = data.workouts.slice().sort(byStartDesc);
  const records = allRecordIds(data.workouts, data.sets);

  if (!list.length) {
    return (
      <main className="screen">
        <h1 className="h1">Historial</h1>
        <div className="card empty">
          <ExerciseIllustration pose="plank" size="lg" />
          <h2 className="h3">Todavía no hay entrenamientos</h2>
          <p className="muted">Cada vez que termines un entrenamiento aparecerá aquí, con sus ejercicios y series.</p>
          <Button variant="primary" onClick={() => setTab('hoy')}>Ir a Hoy</Button>
        </div>
      </main>
    );
  }

  const groups: { label: string; items: Workout[] }[] = [];
  for (const w of list) {
    const label = fmtMonthYear(w.completed_at || w.started_at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(w); else groups.push({ label, items: [w] });
  }

  return (
    <main className="screen">
      <h1 className="h1">Historial</h1>
      {groups.map(g => (
        <section key={g.label} className="stack-sm" aria-label={g.label}>
          <h2 className="eyebrow">{g.label}</h2>
          {g.items.map(w => (
            <HistoryCard key={w.id} w={w} sets={setsOf(data, w.id)} records={records} open={open === w.id} onToggle={() => setOpen(open === w.id ? null : w.id)} />
          ))}
        </section>
      ))}
    </main>
  );
}
