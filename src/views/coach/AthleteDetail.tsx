/* Ficha de un alumno (solo lectura): constancia, últimos entrenamientos,
   dolor marcado y peso corporal. Aquí se asigna o se quita su rutina. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { DiscBadge } from '../../components/DayDisc';
import { Icon } from '../../components/Icon';
import { streak, weeklyCounts, weeklyGoal } from '../../domain/consistency';
import { fmtDate, fmtNum, fmtWeekdayShort } from '../../domain/format';
import { builtinLookup, getProgram } from '../../domain/routines';
import { fmtMinutes, fmtThousands, workoutSummary } from '../../domain/summary';
import type { Program, ProgramLookup, UserData } from '../../domain/types';
import { byStartDesc } from '../../domain/workout';
import type { AthleteRow } from '../../services/coach';
import { useApp } from '../../state/AppContext';

interface Props {
  athlete: AthleteRow;
  programs: Program[];
  onClose(): void;
  onChanged(a: AthleteRow): void;
  onRemoved(id: string): void;
}

export function AthleteDetail({ athlete, programs, onClose, onChanged, onRemoved }: Props) {
  const { coachApi, showToast } = useApp();
  const [data, setData] = useState<UserData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    coachApi!.athleteData(athlete.id)
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setError((e instanceof Error ? e.message : '') || 'No se pudieron cargar los datos del alumno.'); });
    return () => { live = false; };
  }, [coachApi, athlete.id]);

  const lookup = useMemo<ProgramLookup>(() => {
    const m = new Map(programs.map(p => [p.id, p]));
    return id => m.get(id) || builtinLookup(id);
  }, [programs]);

  const assign = async (programId: string | null) => {
    setBusy(programId || 'none');
    try {
      await coachApi!.assign(athlete.id, programId);
      onChanged({ ...athlete, programId });
      const p = programs.find(x => x.id === programId);
      showToast(p ? `${athlete.name} entrenará con "${p.shortName}".` : `${athlete.name} vuelve a su rutina.`);
    } catch (e) { showToast((e instanceof Error ? e.message : '') || 'No se pudo asignar la rutina.'); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      await coachApi!.removeAthlete(athlete.id);
      showToast(`${athlete.name} ya no está en tu lista.`);
      onRemoved(athlete.id);
    } catch (e) { setBusy(null); showToast((e instanceof Error ? e.message : '') || 'No se pudo quitar al alumno.'); }
  };

  const current = athlete.programId ? programs.find(p => p.id === athlete.programId) : null;
  const ownProgram = data?.profile ? getProgram(data.profile.routine_id) : null;
  const active = current || ownProgram;
  const completed = data ? data.workouts.filter(w => w.status === 'completed').sort(byStartDesc) : [];
  const goal = active ? weeklyGoal(active) : 3;
  const thisWeek = data ? weeklyCounts(data.workouts, 1)[0].count : 0;
  const weeks = data ? streak(data.workouts, goal) : 0;
  const weights = data ? [...data.bodyWeights].sort((a, b) => b.date.localeCompare(a.date)) : [];
  const shown = showAll ? completed.slice(0, 30) : completed.slice(0, 5);

  return (
    <main className="screen coach">
      <button type="button" className="back" onClick={onClose}><Icon name="chevL" />Alumnos</button>
      <div className="who">
        <span className="avatar" aria-hidden="true">{athlete.name.trim().charAt(0).toUpperCase() || '?'}</span>
        <div className="tx">
          <h1 className="h1" tabIndex={-1} ref={titleRef}>{athlete.name}</h1>
          <span>Comparte su progreso desde el {fmtDate(athlete.since)}</span>
        </div>
      </div>

      <section className="card card-pad" aria-labelledby="a-rut">
        <h2 className="eyebrow" id="a-rut">Rutina asignada</h2>
        {!programs.length ? (
          <p className="sm">Crea una rutina en la pestaña Rutinas para poder asignarla.</p>
        ) : (
          <div className="opt-list" role="group" aria-labelledby="a-rut">
            <button type="button" className="opt" aria-pressed={!athlete.programId} onClick={() => athlete.programId && assign(null)} aria-busy={busy === 'none' || undefined}>
              <span className="rd" aria-hidden="true">{!athlete.programId && <Icon name="check" />}</span>
              <span>Ninguna{ownProgram ? <span className="sm muted"> · usa la suya ({ownProgram.shortName})</span> : null}</span>
            </button>
            {programs.map(p => (
              <button key={p.id} type="button" className="opt" aria-pressed={athlete.programId === p.id} onClick={() => athlete.programId !== p.id && assign(p.id)} aria-busy={busy === p.id || undefined}>
                <span className="rd" aria-hidden="true">{athlete.programId === p.id && <Icon name="check" />}</span>
                <span>{p.shortName}<span className="sm muted"> · {p.days.length} días</span></span>
              </button>
            ))}
          </div>
        )}
        {current?.safety.requiresHealthNotice && <p className="hint">Tiene aviso de salud: tendrá que aceptarlo antes de entrenar.</p>}
      </section>

      {error && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}
      {!data && !error && <p className="muted" aria-busy="true">Cargando su progreso…</p>}

      {data && (
        <>
          <div className="tiles">
            <div className="card tile sm"><b>{thisWeek} de {goal}</b><span>esta semana{weeks > 0 ? ` · racha de ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}` : ''}</span></div>
            <div className="card tile sm"><b>{completed.length}</b><span>{completed.length === 1 ? 'entrenamiento completado' : 'entrenamientos completados'}</span></div>
          </div>

          <section aria-labelledby="a-hist">
            <h2 className="sec eyebrow" id="a-hist">Últimos entrenamientos</h2>
            {!completed.length ? <p className="sm muted">Todavía no ha completado ningún entrenamiento.</p> : (
              <ul className="coach-wl">
                {shown.map(w => {
                  const p = lookup(w.program_id);
                  const d = p?.days.find(x => x.id === w.day_id);
                  const s = workoutSummary(data, w, lookup);
                  return (
                    <li key={w.id} className="card card-pad aw">
                      <div className="aw-hd">
                        {d && <DiscBadge day={d} size={32} />}
                        <span className="tx"><b>{fmtWeekdayShort(w.completed_at || w.started_at)}</b><span className="sm muted">{d ? `${d.name} — ${d.focus}` : w.day_id}{p ? ` · ${p.shortName}` : ''}</span></span>
                      </div>
                      <p className="sm">
                        {s.sets} de {s.total} series{s.volume > 0 && ` · ${fmtThousands(s.volume)} kg`}{s.minutes != null && ` · ${fmtMinutes(s.minutes)}`}
                        {s.records.length > 0 && ` · ${s.records.length === 1 ? '1 récord' : `${s.records.length} récords`}`}
                      </p>
                      {s.pain.length > 0 && <p className="sum-pain"><Icon name="alert" /><span>Marcó dolor en {s.pain.join(', ')}.</span></p>}
                      {w.notes && <p className="hist-note sm">“{w.notes}”</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {completed.length > 5 && !showAll && <Button variant="link" onClick={() => setShowAll(true)}>Ver más</Button>}
          </section>

          <section className="card card-pad" aria-labelledby="a-peso">
            <h2 className="eyebrow" id="a-peso">Peso corporal</h2>
            {!weights.length ? <p className="sm muted">No ha registrado su peso.</p> : (
              <dl className="dl">
                {weights.slice(0, 5).map(b => <div key={b.id}><dt>{fmtDate(b.date)}</dt><dd>{fmtNum(b.weight_kg)} kg</dd></div>)}
              </dl>
            )}
          </section>
          <p className="hint">Solo lectura. Las notas que tu alumno escribe en cada ejercicio no se comparten.</p>
        </>
      )}

      {!confirm ? (
        <Button variant="link" icon="trash" onClick={() => setConfirm(true)} style={{ alignSelf: 'center' }}>Quitar de mis alumnos</Button>
      ) : (
        <div className="confirm" role="group" aria-labelledby="rm-q">
          <p id="rm-q"><b>¿Quitar a {athlete.name}?</b> Dejarás de ver su progreso y perderá la rutina asignada. Sus datos no se borran.</p>
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setConfirm(false)} autoFocus>Cancelar</Button>
            <Button variant="danger" onClick={remove} loading={busy === 'remove'}>Quitar</Button>
          </div>
        </div>
      )}
    </main>
  );
}
