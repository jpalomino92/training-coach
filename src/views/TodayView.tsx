/* ==========================================================
   HOY: una sola tarea a la vez. Solo el ejercicio activo está abierto.
   Sin botón "Empezar": la primera serie registrada pone el día en progreso.
   ========================================================== */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DayDisc, DiscBadge } from '../components/DayDisc';
import { ExerciseCard } from '../components/ExerciseCard';
import { ExerciseRow } from '../components/ExerciseRow';
import { HalfIcon } from '../components/Icon';
import { HealthNoticeCompact } from '../components/HealthNotice';
import { WorkoutNote, WorkoutSummaryCard } from '../components/WorkoutSummary';
import { fmtDate, fmtToday } from '../domain/format';
import { restFor } from '../domain/prefs';
import type { Exercise, Feel } from '../domain/types';
import { streak, weeklyCounts, weeklyGoal } from '../domain/consistency';
import { altExercise, altKey, baseKey } from '../domain/alternatives';
import { activeWorkout, dayStatus, isExerciseDone, lastSessionFor, programWorkouts, totalSets, usesAlternative } from '../domain/workout';
import { useApp, useDay } from '../state/AppContext';
import { useTimer, vibrate } from '../state/TimerContext';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const scrollToEl = (el: Element | null, block: ScrollLogicalPosition = 'start') => el?.scrollIntoView?.({ behavior: reduceMotion() ? 'auto' : 'smooth', block });

export function TodayView() {
  const app = useApp();
  const { data, program, profile, setDayId, setTab, showToast, prefs } = app;
  const { day, workout, sets } = useDay();
  const timer = useTimer();
  const [openKey, setOpenKey] = useState<Record<string, string>>({});
  /** Alternativa elegida antes de registrar la primera serie: `${día}:${ejercicio}` */
  const [altChoice, setAltChoice] = useState<Record<string, boolean>>({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const total = totalSets(day);
  const doneCount = sets.length;
  const status = dayStatus(workout);
  const exSets = (ex: Exercise) => sets.filter(s => s.exercise_key === ex.key).sort((a, b) => a.set_index - b.set_index);
  /** El ejercicio que se hace hoy: el de la rutina o su alternativa. */
  const variantOf = (ex: Exercise): Exercise => {
    if (usesAlternative(sets, ex)) return altExercise(ex);
    if (sets.some(s => s.exercise_key === ex.key)) return ex;
    return altChoice[`${day.id}:${ex.key}`] ? altExercise(ex) : ex;
  };
  const firstOpen = day.exercises.find(e => !isExerciseDone(sets, e));
  const activeKey = openKey[day.id] && day.exercises.some(e => e.key === openKey[day.id]) ? openKey[day.id] : firstOpen?.key ?? null;
  const active = day.exercises.find(e => e.key === activeKey) || null;
  const activeIdx = active ? day.exercises.indexOf(active) : -1;
  const doneList = day.exercises.filter(e => e !== active && isExerciseDone(sets, e));
  const nextList = day.exercises.filter(e => e !== active && !isExerciseDone(sets, e));
  const nextAfterActive = active ? (day.exercises.slice(activeIdx + 1).find(e => !isExerciseDone(sets, e)) || day.exercises.find(e => e !== active && !isExerciseDone(sets, e)) || null) : null;

  // Al volver a Hoy con un entrenamiento en marcha, baja sola hasta la serie activa
  useLayoutEffect(() => {
    if (workout?.status !== 'in_progress') { window.scrollTo({ top: 0 }); return; }
    const el = document.querySelector('.xcard .set-edit');
    if (el) el.scrollIntoView?.({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cabecera compacta fija al hacer scroll
  useEffect(() => {
    const el = headRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => { if (confirmFinish) confirmRef.current?.focus(); }, [confirmFinish]);

  const guard = async (fn: () => Promise<void>) => {
    try { await fn(); } catch (e) { console.error(e); showToast(e instanceof Error ? e.message : 'Algo no ha funcionado. Inténtalo de nuevo.'); }
  };

  const openExercise = (key: string) => {
    setOpenKey(m => ({ ...m, [day.id]: key }));
    requestAnimationFrame(() => scrollToEl(document.getElementById(`ex-${key}`)));
  };

  const record = async (ex: Exercise, index: number, v: { weight: number | null; reps: number; rir: number | null }, mode: 'new' | 'edit') => {
    let rec = null;
    await guard(async () => {
      const r = await app.recordSet(day, ex, index, v);
      rec = r.set;
      // El ejercicio sigue abierto al completarlo: "¿Cómo lo sentiste hoy?" y "Siguiente: …"
      setOpenKey(m => ({ ...m, [day.id]: baseKey(ex.key) }));
      if (r.dayCompleted) {
        timer.stop();
        showToast('¡Entrenamiento completado!');
        return;
      }
      if (mode === 'edit') return; // Editar no reinicia el temporizador
      vibrate(30);
      const doneNow = new Set([...exSets(ex).map(s => s.set_index), index]);
      const nextSet = Array.from({ length: ex.sets }, (_, i) => i).find(i => !doneNow.has(i));
      if (nextSet != null) {
        timer.start(restFor(ex, prefs), `Descanso · luego serie ${nextSet + 1} de ${ex.sets}`, `Toca: ${ex.name} · serie ${nextSet + 1}`);
      } else {
        const nx = nextAfterActive;
        timer.start(restFor(ex, prefs), nx ? `Descanso · luego ${nx.name}` : 'Descanso', nx ? `Toca: ${nx.name} · serie 1` : 'Revisa las series que te quedan.');
      }
    });
    return rec;
  };

  const finish = () => guard(async () => {
    setBusy(true);
    try {
      await app.finishWorkout(day);
      timer.stop();
      setConfirmFinish(false);
      showToast('Entrenamiento guardado.');
    } finally { setBusy(false); }
  });

  const programIds = new Set(programWorkouts(data, program).map(w => w.id));
  const historyOf = (key: string) => data.sets.filter(s => s.exercise_key === key && programIds.has(s.workout_id));
  const goal = weeklyGoal(program);
  const thisWeek = weeklyCounts(data.workouts, 1)[0].count;
  const weeks = streak(data.workouts, goal);

  const cardFor = (base: Exercise) => {
    const ex = variantOf(base);
    const locked = sets.some(s => s.exercise_key === base.key || s.exercise_key === altKey(base.key));
    const last = lastSessionFor(data, program, ex.key, workout?.id);
    return (
      <ExerciseCard
        key={ex.key} ex={ex} anchor={base.key} rest={restFor(ex, prefs)} barKg={prefs.bar_kg} number={day.exercises.indexOf(base) + 1} total={day.exercises.length} program={program}
        alternative={base.alt ? {
          active: ex.key !== base.key, locked, baseName: base.name, altName: base.alt,
          onToggle: () => setAltChoice(m => ({ ...m, [`${day.id}:${base.key}`]: ex.key === base.key }))
        } : undefined}
        sets={exSets(ex)} history={historyOf(ex.key)} last={last} lastFeel={last?.workout.feel?.[ex.key]} feel={workout?.feel?.[ex.key]}
        note={data.notes[ex.key]?.note || ''} next={nextAfterActive}
        onRecord={(i, v, mode) => record(ex, i, v, mode)}
        onDelete={s => guard(() => app.removeSet(s))}
        onFeel={(f: Feel | null) => guard(async () => {
          await app.setFeel(day, ex.key, f);
          if (f === 'pain') showToast('Detén el ejercicio. Si el dolor continúa, consulta con un profesional sanitario.');
        })}
        onSaveNote={t => app.saveNote(ex.key, t)}
        onNext={() => nextAfterActive && openExercise(nextAfterActive.key)}
      />
    );
  };

  const remaining = total - doneCount;
  return (
    <div className="today">
      <div className={`compact${compact ? ' show' : ''}`} aria-hidden={!compact}>
        <div className="in">
          <DiscBadge day={day} size={36} />
          <span className="t">{day.name} — {day.focus}</span>
          <span className="n">{doneCount} / {total}</span>
          <div className="bar"><i style={{ width: `${(doneCount / total) * 100}%` }} /></div>
        </div>
      </div>

      <header className="greet">
        <span className="eyebrow">{fmtToday(new Date())}</span>
        <h1 className="h1">Hola, {profile?.name}</h1>
        <p className="week-goal">
          <b>Esta semana: {thisWeek} de {goal}</b> {goal === 1 ? 'entrenamiento' : 'entrenamientos'}
          {weeks > 0 && <> · racha de {weeks} {weeks === 1 ? 'semana' : 'semanas'}</>}
        </p>
      </header>

      <HealthNoticeCompact safety={program.safety} />

      <div className="discs" role="group" aria-label="Elegir día">
        {program.days.map(d => (
          <DayDisc key={d.id} day={d} status={dayStatus(activeWorkout(data, program, d.id))} selected={d.id === day.id}
            onSelect={() => { setDayId(d.id); setConfirmFinish(false); }} />
        ))}
      </div>

      <div className="dayhead" ref={headRef}>
        <h2 className="h2"><span>{day.name} —</span> {day.focus}</h2>
        {status === 'none' && <span className="status none"><span className="g" aria-hidden="true">○</span>No iniciado</span>}
        {status === 'prog' && <span className="status prog"><HalfIcon className="g" />En progreso · {doneCount} de {total} series</span>}
        {status === 'done' && <span className="status done"><span className="g" aria-hidden="true">✓</span>Completado el {fmtDate(workout!.completed_at)}</span>}
        {status !== 'none' && (
          <div className="bar" role="progressbar" aria-label="Series registradas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
            <i style={{ width: `${Math.min(100, (doneCount / total) * 100)}%` }} />
          </div>
        )}
        {status === 'none' && (
          <p className="day-info">{day.exercises.length} ejercicios · {total} series. La primera serie que registres inicia el entrenamiento.</p>
        )}
      </div>

      <div className="list">
        {doneList.length > 0 && (
          <>
            <h3 className="sec eyebrow">Hecho</h3>
            {doneList.map(ex => (
              <ExerciseRow key={ex.key} ex={variantOf(ex)} number={day.exercises.indexOf(ex) + 1} sets={exSets(variantOf(ex))} feel={workout?.feel?.[variantOf(ex).key]} onOpen={() => openExercise(ex.key)} />
            ))}
          </>
        )}
        {active && (
          <>
            <h3 className="sec eyebrow">Ahora</h3>
            {cardFor(active)}
          </>
        )}
        {nextList.length > 0 && (
          <>
            <h3 className="sec eyebrow">Siguientes · {nextList.length} {nextList.length === 1 ? 'ejercicio' : 'ejercicios'}</h3>
            {nextList.map(ex => (
              <ExerciseRow key={ex.key} ex={variantOf(ex)} number={day.exercises.indexOf(ex) + 1} sets={exSets(variantOf(ex))} onOpen={() => openExercise(ex.key)} />
            ))}
          </>
        )}
      </div>

      {workout?.status === 'in_progress' && (
        <div className="finish">
          {!confirmFinish ? (
            <>
              <Button variant="secondary" block onClick={() => (remaining > 0 ? setConfirmFinish(true) : finish())} loading={busy}>Terminar entrenamiento</Button>
              <p className="hint tc">Puedes terminar aunque queden series sin hacer.</p>
            </>
          ) : (
            <div className="confirm" role="group" aria-labelledby="finish-q">
              <p id="finish-q"><b>Quedan {remaining} {remaining === 1 ? 'serie' : 'series'} sin registrar.</b> ¿Terminar el entrenamiento igualmente?</p>
              <div className="btn-row">
                <Button ref={confirmRef} variant="secondary" onClick={() => setConfirmFinish(false)}>Cancelar</Button>
                <Button variant="primary" onClick={finish} loading={busy}>Terminar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {workout?.status === 'completed' && <div className="summary-wrap"><WorkoutSummaryCard workout={workout} onHistory={() => setTab('historial')} /></div>}

      {workout && <div className="note-wrap"><WorkoutNote key={workout.id} workout={workout} /></div>}
    </div>
  );
}
