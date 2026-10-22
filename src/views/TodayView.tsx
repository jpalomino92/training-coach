/* ==========================================================
   HOY: una sola tarea a la vez. Solo el ejercicio activo está abierto.
   Sin botón "Empezar": la primera serie registrada pone el día en progreso.
   Biseries y circuitos: sus ejercicios se abren juntos y se alternan
   serie a serie; el descanso llega al terminar cada vuelta.
   ========================================================== */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { DayDisc, DiscBadge } from '../components/DayDisc';
import { ExerciseCard } from '../components/ExerciseCard';
import { ExerciseRow } from '../components/ExerciseRow';
import { HalfIcon, Icon } from '../components/Icon';
import { HealthNoticeCompact, HealthNoticeFull } from '../components/HealthNotice';
import { WorkoutNote, WorkoutSummaryCard } from '../components/WorkoutSummary';
import { WorkoutDoneSheet } from '../components/WorkoutDoneSheet';
import { fmtDate, fmtToday, restText } from '../domain/format';
import { restFor } from '../domain/prefs';
import type { Exercise, Feel, Program, SupersetPrefs } from '../domain/types';
import { streak, weeklyCounts, weeklyGoal } from '../domain/consistency';
import { altExercise, altKey, baseKey } from '../domain/alternatives';
import { activeWorkout, dayStatus, isExerciseDone, lastSessionFor, lastUsedAlternative, programWorkouts, totalSets, usesAlternative } from '../domain/workout';
import { canPair, dayUnits, doneIndexes, isGroup, nextTurn, supersetKey, unitLabel, unitRounds, withGroup, withoutUnit, withPair, type DayUnit } from '../domain/supersets';
import { useApp, useDay } from '../state/AppContext';
import { useTimer, vibrate } from '../state/TimerContext';

const reduceMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const scrollToEl = (el: Element | null, block: ScrollLogicalPosition = 'start') => el?.scrollIntoView?.({ behavior: reduceMotion() ? 'auto' : 'smooth', block });

/** Rutina asignada por el entrenador con aviso de salud: hay que aceptarlo antes de entrenar. */
function AssignedNoticeGate({ program, name }: { program: Program; name: string }) {
  const { acceptHealthNotice, showToast } = useApp();
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    try { await acceptHealthNotice(program.id); } catch (e) { setBusy(false); showToast(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  };
  return (
    <main className="screen">
      <div className="stack-sm">
        <span className="eyebrow">Rutina nueva</span>
        <h1 className="h1">Hola, {name}</h1>
        <p className="lead">{program.coachName ? `${program.coachName} te ha asignado` : 'Tu entrenador te ha asignado'} <b>{program.shortName}</b>. Antes de empezar, lee el aviso.</p>
      </div>
      <HealthNoticeFull safety={program.safety}>
        <label className="check">
          <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
          <span>{program.safety.ackText}</span>
        </label>
      </HealthNoticeFull>
      <Button variant="primary" block onClick={accept} loading={busy} disabledReason={ack ? null : 'Marca la casilla del aviso para continuar'} showReason>Empezar</Button>
    </main>
  );
}

export function TodayView() {
  const app = useApp();
  const { data, program, profile, setDayId, setTab, showToast, prefs } = app;
  const { day, workout, sets } = useDay();
  const timer = useTimer();
  const [openKey, setOpenKey] = useState<Record<string, string>>({});
  /** Alternativa elegida antes de registrar la primera serie: `${día}:${ejercicio}`. Sin elegir, se repite la modalidad de la última vez. */
  const [altChoice, setAltChoice] = useState<Record<string, boolean>>({});
  const [confirmFinish, setConfirmFinish] = useState(false);
  /** Entrenamiento recién terminado: muestra la ventana de resumen. */
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const total = totalSets(day);
  const doneCount = sets.length;
  const status = dayStatus(workout);
  const carriedAlt = (ex: Exercise) => !!ex.alt && lastUsedAlternative(data, program, ex, workout?.id);
  const exSets = (ex: Exercise) => sets.filter(s => s.exercise_key === ex.key).sort((a, b) => a.set_index - b.set_index);
  /** El ejercicio que se hace hoy: el de la rutina o su alternativa. */
  const variantOf = (ex: Exercise): Exercise => {
    if (usesAlternative(sets, ex)) return altExercise(ex);
    if (sets.some(s => s.exercise_key === ex.key)) return ex;
    return (altChoice[`${day.id}:${ex.key}`] ?? carriedAlt(ex)) ? altExercise(ex) : ex;
  };
  // El día se recorre por bloques: un ejercicio suelto, una biserie o un circuito
  const spKey = supersetKey(program.id, day.id);
  const sp: SupersetPrefs = prefs.supersets?.[spKey] || {};
  const units = dayUnits(day, sp);
  const unitDone = (u: DayUnit) => u.exercises.every(e => isExerciseDone(sets, e));
  const unitOf = (key: string) => units.find(u => u.exercises.some(e => e.key === key));
  const active = (openKey[day.id] && unitOf(openKey[day.id])) || units.find(u => !unitDone(u)) || null;
  const activeIdx = active ? units.indexOf(active) : -1;
  const doneList = units.filter(u => u !== active && unitDone(u));
  const nextList = units.filter(u => u !== active && !unitDone(u));
  const nextUnit = active ? (units.slice(activeIdx + 1).find(u => !unitDone(u)) || units.find(u => u !== active && !unitDone(u)) || null) : null;
  const nextAfterActive = nextUnit?.exercises[0] ?? null;
  const nextCount = nextList.reduce((n, u) => n + u.exercises.length, 0);

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
        setCelebrate(r.set.workout_id);
        return;
      }
      if (mode === 'edit') return; // Editar no reinicia el temporizador
      vibrate(30);
      const unit = unitOf(baseKey(ex.key));
      if (unit && isGroup(unit)) {
        const after = [...sets.filter(s => !(s.exercise_key === ex.key && s.set_index === index)), r.set];
        const turn = nextTurn(unit.exercises, after);
        if (turn && turn.set === index) {
          // Misma vuelta: el siguiente ejercicio, sin descanso
          timer.stop();
          setOpenKey(m => ({ ...m, [day.id]: turn.ex.key }));
          requestAnimationFrame(() => scrollToEl(document.querySelector(`#ex-${turn.ex.key} .set-edit`), 'center'));
          return;
        }
        const rest = Math.max(...unit.exercises.map(e => restFor(variantOf(e), prefs)));
        if (turn) {
          const nx = variantOf(turn.ex);
          timer.start(rest, `Descanso · luego vuelta ${turn.set + 1}: ${nx.name}`, `Toca: ${nx.name} · serie ${turn.set + 1}`);
        } else {
          const nx = nextAfterActive;
          timer.start(rest, nx ? `Descanso · luego ${nx.name}` : 'Descanso', nx ? `Toca: ${nx.name} · serie 1` : 'Revisa las series que te quedan.');
        }
        return;
      }
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
      if (workout) setCelebrate(workout.id);
    } finally { setBusy(false); }
  });

  const programIds = new Set(programWorkouts(data, program).map(w => w.id));
  const historyOf = (key: string) => data.sets.filter(s => s.exercise_key === key && programIds.has(s.workout_id));
  const goal = weeklyGoal(program);
  const thisWeek = weeklyCounts(data.workouts, 1)[0].count;
  const weeks = streak(data.workouts, goal);

  const saveSuperset = (next: SupersetPrefs, msg: string) => guard(async () => {
    await app.updateSettings({ supersets: { ...(prefs.supersets || {}), [spKey]: next } });
    showToast(msg);
  });

  /** Acción de biserie para un ejercicio suelto: unirlo al siguiente o volver al grupo de la rutina. */
  const supersetAction = (u: DayUnit) => {
    if (isGroup(u)) return undefined;
    const ex = u.exercises[0];
    if (ex.group && sp.split?.includes(ex.group)) {
      const circuit = day.exercises.filter(e => e.group === ex.group).length > 2;
      return {
        label: `Volver a hacerlo en ${circuit ? 'circuito' : 'biserie'}, como indica la rutina`,
        onClick: () => saveSuperset(withGroup(sp, ex.group!), circuit ? 'Vuelves al circuito.' : 'Vuelves a la biserie.')
      };
    }
    const next = units[units.indexOf(u) + 1];
    if (!canPair(u, next) || isExerciseDone(sets, ex) || isExerciseDone(sets, next.exercises[0])) return undefined;
    const b = next.exercises[0];
    return { label: `Hacer en biserie con ${variantOf(b).name}`, onClick: () => saveSuperset(withPair(sp, ex.key, b.key), 'Biserie guardada. Se mantiene las próximas semanas.') };
  };

  /** En una biserie, cuándo le toca a este ejercicio (sin texto si es su turno o ya terminó). */
  const waitText = (base: Exercise, turn: { ex: Exercise; set: number } | null) => {
    if (!turn || turn.ex === base) return undefined;
    const done = doneIndexes(sets, base);
    const nextSet = Array.from({ length: base.sets }, (_, i) => i).find(i => !done.has(i));
    if (nextSet == null) return undefined;
    return nextSet === turn.set ? `después de ${variantOf(turn.ex).name}` : 'en la siguiente vuelta';
  };

  const cardFor = (base: Exercise, group?: { unit: DayUnit; turn: { ex: Exercise; set: number } | null }) => {
    const ex = variantOf(base);
    const isLast = !!group && group.unit.exercises[group.unit.exercises.length - 1] === base;
    const groupRest = group ? Math.max(...group.unit.exercises.map(e => restFor(variantOf(e), prefs))) : 0;
    const locked = sets.some(s => s.exercise_key === base.key || s.exercise_key === altKey(base.key));
    const last = lastSessionFor(data, program, ex.key, workout?.id);
    return (
      <ExerciseCard
        key={ex.key} ex={ex} anchor={base.key} rest={restFor(ex, prefs)} barKg={prefs.bar_kg} number={day.exercises.indexOf(base) + 1} total={day.exercises.length} program={program}
        alternative={base.alt ? {
          active: ex.key !== base.key, locked, baseName: base.name, altName: base.alt,
          carried: ex.key !== base.key && !locked && altChoice[`${day.id}:${base.key}`] == null && carriedAlt(base),
          onToggle: () => setAltChoice(m => ({ ...m, [`${day.id}:${base.key}`]: ex.key === base.key }))
        } : undefined}
        sets={exSets(ex)} history={historyOf(ex.key)} last={last} lastFeel={last?.workout.feel?.[ex.key]} feel={workout?.feel?.[ex.key]}
        note={data.notes[ex.key]?.note || ''} next={group ? null : nextAfterActive}
        waitFor={group ? waitText(base, group.turn) : undefined}
        restLabel={group ? (isLast ? `Descanso ${restText(groupRest)} al terminar la vuelta` : 'Sin descanso') : undefined}
        superset={group ? undefined : supersetAction(unitOf(base.key)!)}
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

  /** Biserie o circuito abierto: sus ejercicios juntos, alternando serie a serie. */
  const groupBlock = (u: DayUnit) => {
    const turn = nextTurn(u.exercises, sets);
    const label = unitLabel(u);
    return (
      <section className="ss" aria-label={`${label}: ${u.exercises.map(e => variantOf(e).name).join(' y ')}`}>
        <div className="ss-head">
          <span className="ss-tag"><Icon name="link" />{label} · {unitRounds(u)} vueltas</span>
          {turn && <p className="hint">Haz una serie de cada ejercicio seguida y descansa al terminar la vuelta.</p>}
          {turn && (
            <button type="button" className="btn btn-link" onClick={() => saveSuperset(withoutUnit(sp, u), 'Ahora cada ejercicio va por separado.')}>
              Hacer los ejercicios por separado
            </button>
          )}
        </div>
        {u.exercises.map(e => cardFor(e, { unit: u, turn }))}
        {!turn && nextAfterActive && (
          <Button variant="primary" block className="next-btn" iconRight="chevR" onClick={() => openExercise(nextAfterActive.key)}>
            <span>Siguiente: {variantOf(nextAfterActive).name}</span>
          </Button>
        )}
      </section>
    );
  };

  const rowsFor = (u: DayUnit, withFeel: boolean) => {
    const rows = u.exercises.map(ex => {
      const v = variantOf(ex);
      return <ExerciseRow key={ex.key} ex={v} number={day.exercises.indexOf(ex) + 1} sets={exSets(v)} feel={withFeel ? workout?.feel?.[v.key] : undefined} onOpen={() => openExercise(ex.key)} />;
    });
    if (!isGroup(u)) return rows;
    return (
      <div key={u.exercises[0].key} className="ss-rows" role="group" aria-label={`${unitLabel(u)} · ${unitRounds(u)} vueltas`}>
        <span className="ss-tag"><Icon name="link" />{unitLabel(u)} · {unitRounds(u)} vueltas</span>
        {rows}
      </div>
    );
  };

  if (program.custom && program.safety.requiresHealthNotice && !prefs.acks?.[program.id]) {
    return <AssignedNoticeGate program={program} name={profile?.name || ''} />;
  }

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
            {doneList.map(u => rowsFor(u, true))}
          </>
        )}
        {active && (
          <>
            <h3 className="sec eyebrow">Ahora</h3>
            {isGroup(active) ? groupBlock(active) : cardFor(active.exercises[0])}
          </>
        )}
        {nextList.length > 0 && (
          <>
            <h3 className="sec eyebrow">Siguientes · {nextCount} {nextCount === 1 ? 'ejercicio' : 'ejercicios'}</h3>
            {nextList.map(u => rowsFor(u, false))}
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

      {workout?.status === 'completed' && celebrate === workout.id && <WorkoutDoneSheet workout={workout} onClose={() => setCelebrate(null)} />}
    </div>
  );
}
