/* Tarjeta del ejercicio activo en Hoy.
   Estados: activa con última sesión, sin datos previos y completa
   ("¿Cómo lo sentiste hoy?" + "Siguiente: …"). */
import { useEffect, useId, useRef, useState } from 'react';
import { fmtDate, loadText, restText, setText, targetText } from '../domain/format';
import { suggest } from '../domain/progression';
import { recordFor } from '../domain/records';
import { BARBELL_KEYS } from '../domain/plates';
import type { Exercise, Feel, Program, WorkoutSet } from '../domain/types';
import { lastSetAt, prefillFor, type LastSession as Last } from '../domain/workout';
import { setNote, TECHNIQUES } from '../domain/setTechnique';
import type { Stall } from '../domain/stagnation';
import type { Suggestion } from '../domain/progression';
import { exerciseMood, ghostTarget, MOOD_TEXT, setsVersus, setVersus, type Ghost } from '../domain/ghost';
import { GhostArt } from './GhostArt';
import { WarmupPanel } from './WarmupPanel';
import { needsWarmup } from '../domain/warmup';
import { Button } from './Button';
import { ExerciseIllustration } from './ExerciseIllustration';
import { FeelPicker } from './FeelPicker';
import { Icon } from './Icon';
import { LastSession } from './LastSession';
import { SetDone, SetEditor, SetPending, draftFrom } from './SetRow';
import { SuggestionBox } from './SuggestionBox';
import { TechniquePanel, type TechniquePanelHandle } from './TechniquePanel';

export interface AlternativeToggle {
  /** Se está haciendo la alternativa. */
  active: boolean;
  /** Ya hay series registradas hoy: no se puede cambiar. */
  locked: boolean;
  baseName: string;
  altName: string;
  /** Viene de la última sesión, que se hizo con la alternativa. */
  carried?: boolean;
  onToggle(): void;
}

export interface ExerciseCardProps {
  ex: Exercise;
  /** Clave del ejercicio de la rutina (ancla para el scroll). */
  anchor: string;
  alternative?: AlternativeToggle;
  /** Descanso que se aplica (rutina o personalizado). */
  rest: number;
  /** Peso de la barra (para la calculadora de discos). */
  barKg: number;
  number: number;
  total: number;
  program: Program;
  /** Series de hoy de este ejercicio. */
  sets: WorkoutSet[];
  /** Todas las series registradas de este ejercicio (para los récords). */
  history: WorkoutSet[];
  last: Last | null;
  lastFeel?: Feel;
  feel?: Feel;
  note: string;
  next?: Exercise | null;
  /** En una biserie: aún no toca su serie ("después de Remo", "en la siguiente vuelta"). */
  waitFor?: string;
  /** Texto del descanso si no es el del ejercicio (p. ej. "Sin descanso" dentro de una biserie). */
  restLabel?: string;
  /** Ejercicio estancado y los planes para salir. */
  stall?: { stall: Stall; alternative?: string; onReset?(): void; onAlt?(): void; onDismiss(): void };
  /** Sugerencia que manda sobre la de progresión (plan de reinicio, semana de descarga). */
  suggestion?: Suggestion;
  /** Peso con el que llega la primera serie (reinicio o descarga). */
  startWeight?: number;
  /** Mostrar el calentamiento antes de la serie 1 (básicos con carga). */
  warmup?: boolean;
  /** Tu sesión de hace un mes en este ejercicio (null: sin fantasma o desactivado). */
  ghost?: Ghost | null;
  /** Acción de biserie: hacerlo junto al siguiente ejercicio o volver al grupo de la rutina. */
  superset?: { label: string; onClick(): void };
  onRecord(index: number, v: { weight: number | null; reps: number; rir: number | null }, mode: 'new' | 'edit'): Promise<WorkoutSet | null>;
  onDelete(set: WorkoutSet): Promise<void>;
  onFeel(v: Feel | null): void;
  onSaveNote(text: string): Promise<void>;
  onNext(): void;
}

export function ExerciseCard(p: ExerciseCardProps) {
  const { ex, sets, last } = p;
  const [editing, setEditing] = useState<number | null>(null);
  const [fresh, setFresh] = useState<{ id: string; record?: string } | null>(null);
  const techRef = useRef<TechniquePanelHandle>(null);
  const feelId = useId();
  const byIndex = new Map(sets.map(s => [s.set_index, s]));
  const complete = sets.length >= ex.sets && Array.from({ length: ex.sets }, (_, i) => byIndex.has(i)).every(Boolean);
  const current = editing ?? Array.from({ length: ex.sets }, (_, i) => i).find(i => !byIndex.has(i)) ?? null;

  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), fresh.record ? 4000 : 2000);
    return () => clearTimeout(t);
  }, [fresh]);

  const computed = suggest(ex, last?.sets, p.program, p.lastFeel);
  // El dolor siempre manda; si no, el plan de reinicio o la descarga
  const sug = p.suggestion && computed.level !== 'pain' ? p.suggestion : computed;
  const lastRef = (i: number) => { const s = lastSetAt(last, i); return s ? `Última vez: ${setText(ex, { ...s, rir: null })}` : undefined; };

  const rows = Array.from({ length: ex.sets }, (_, i) => {
    const saved = byIndex.get(i);
    if (i === current && !saved && editing == null && p.waitFor) return <SetPending key={`w${i}`} index={i} wait={p.waitFor} />;
    if (i === current) {
      const mode = saved ? 'edit' : 'new';
      const pre = prefillFor(ex, i, sets, last);
      const initial = saved ? draftFrom(saved) : draftFrom(i === 0 && !sets.length && p.startWeight != null ? { ...pre, weight: p.startWeight } : pre);
      return (
        <SetEditor key={`${ex.key}-${i}-${mode}-${p.startWeight ?? ''}`} ex={ex} index={i} mode={mode} initial={initial} reference={lastRef(i)}
          barKg={BARBELL_KEYS.has(ex.key) ? p.barKg : undefined} note={setNote(ex, i)} ghostRef={ghostTarget(ex, p.ghost ?? null, i)}
          onSubmit={async v => {
            const before = p.history;
            const rec = await p.onRecord(i, v, mode);
            setEditing(null);
            if (rec) setFresh({ id: rec.id, record: mode === 'new' ? recordFor(ex, rec, before)?.text : undefined });
          }}
          onCancel={() => setEditing(null)}
          onDelete={saved ? async () => { await p.onDelete(saved); setEditing(null); } : undefined}
        />
      );
    }
    const ghostSet = p.ghost?.sets.find(s => s.set_index === i);
    if (saved) return <SetDone key={saved.id} set={saved} ex={ex} fresh={fresh?.id === saved.id} record={fresh?.id === saved.id ? fresh.record : undefined}
      versus={ghostSet ? setVersus(ex, saved, ghostSet) : undefined} onEdit={() => setEditing(i)} />;
    return <SetPending key={`p${i}`} index={i} />;
  });

  return (
    <article className={`xcard${complete ? ' complete' : ''}`} id={`ex-${p.anchor}`} aria-labelledby={`${feelId}-t`}>
      <div className="xhead">
        <ExerciseIllustration pose={ex.pose} size="lg" imageSrc={ex.gifUrl} />
        <div className="tx">
          {complete
            ? <span className="done-head"><Icon name="check" />Ejercicio completado</span>
            : <span className="num">Ejercicio {p.number} de {p.total}{p.alternative?.active ? ' · alternativa' : ''}</span>}
          <h3 className="h3" id={`${feelId}-t`}>{ex.name}</h3>
        </div>
      </div>

      {!complete && (
        <div className="chips">
          <span className="chip key">{targetText(ex)}</span>
          {ex.rir && <span className="chip">RIR {ex.rir}</span>}
          <span className="chip"><Icon name="clock" />{p.restLabel ?? `Descanso ${restText(p.rest)}`}</span>
          <span className="chip">{ex.muscle}</span>
          {ex.setTechnique && <span className="chip">Serie 2: {TECHNIQUES[ex.setTechnique].name}</span>}
        </div>
      )}

      {!complete && p.alternative && !(p.alternative.locked && !p.alternative.active) && (
        <div className={`alt-switch${p.alternative.active ? ' on' : ''}`}>
          {p.alternative.active ? (
            <>
              {p.alternative.carried
                ? <span>La última vez hiciste la alternativa de <b>{p.alternative.baseName}</b>, así que hoy sigue siendo la principal. Sus pesos se guardan aparte.</span>
                : <span>Estás haciendo la alternativa de <b>{p.alternative.baseName}</b>. Sus pesos se guardan aparte.</span>}
              {!p.alternative.locked && <button type="button" className="btn btn-link" onClick={p.alternative.onToggle}>{p.alternative.carried ? 'Cambiar a' : 'Volver a'} {p.alternative.baseName}</button>}
            </>
          ) : (
            <button type="button" className="btn btn-link" onClick={p.alternative.onToggle}>
              <Icon name="rutina" />¿Máquina ocupada? Hacer la alternativa: {p.alternative.altName}
            </button>
          )}
        </div>
      )}

      {!complete && p.superset && (
        <div className="alt-switch">
          <button type="button" className="btn btn-link" onClick={p.superset.onClick}><Icon name="link" />{p.superset.label}</button>
        </div>
      )}

      {!complete && p.stall && !sets.length && (() => {
        const st = p.stall.stall;
        return (
          <div className="stall" role="group" aria-label="Ejercicio estancado">
            <p className="hd"><Icon name="alert" /><b>Este ejercicio está estancado</b></p>
            <p className="sm">
              {st.sessions >= 3 && <>Llevas {st.weeks} {st.weeks === 1 ? 'semana' : 'semanas'} ({st.sessions} sesiones) sin superar {setText(ex, { ...st.best, rir: null })}. </>}
              {st.ghostLosses >= 3 && <>Rocky te ganó las últimas {st.ghostLosses} sesiones. </>}
              Prueba uno de estos planes durante 4 semanas:
            </p>
            <div className="stall-act">
              {p.stall.onReset && st.resetWeight != null && <Button variant="secondary" block onClick={p.stall.onReset}>{ex.assisted ? `Subir a ${loadText(st.resetWeight, ex)} y volver a bajar` : `Bajar a ${loadText(st.resetWeight, ex)} y volver a subir`}</Button>}
              {p.stall.onAlt && p.stall.alternative && <Button variant="secondary" block onClick={p.stall.onAlt}>Pasar a la alternativa: {p.stall.alternative}</Button>}
              <button type="button" className="btn btn-link" onClick={p.stall.onDismiss}>Ahora no</button>
            </div>
          </div>
        );
      })()}

      {!complete && (
        <div className="pair">
          <LastSession ex={ex} last={last} firstHint={sug.level === 'none' ? sug.reason : ''} />
          {sug.level !== 'none' && (
            <SuggestionBox s={sug} alternative={ex.alt} onShowAlternative={() => techRef.current?.showAlternative()}
              painDate={last ? fmtDate(last.workout.completed_at || last.workout.started_at) : undefined} />
          )}
        </div>
      )}

      {p.ghost && (() => {
        const mood = exerciseMood(setsVersus(ex, sets, p.ghost), complete);
        return (
          <div className={`ghost-line ${mood}`}>
            <GhostArt mood={mood} size="xs" />
            <p>
              <b>Rocky</b> · {fmtDate(p.ghost.workout.completed_at || p.ghost.workout.started_at)}: {p.ghost.sets.map(s => setText(ex, { ...s, rir: null })).join(' / ')}
              <span className="ghost-quote">«{MOOD_TEXT[mood]}»</span>
            </p>
          </div>
        );
      })()}

      {p.warmup && !complete && !sets.length && needsWarmup(ex) && (
        <WarmupPanel key={`${ex.key}-${p.startWeight ?? ''}`} ex={ex} barKg={BARBELL_KEYS.has(ex.key) ? p.barKg : undefined}
          work={p.startWeight ?? prefillFor(ex, 0, sets, last).weight} />
      )}

      <div className="sets">{rows}</div>

      {complete && (
        <>
          <FeelPicker id={`${feelId}-f`} value={p.feel} onChange={p.onFeel} />
          {p.next && (
            <Button variant="primary" block className="next-btn" iconRight="chevR" onClick={p.onNext}>
              <span>Siguiente: {p.next.name}</span>
            </Button>
          )}
        </>
      )}

      <TechniquePanel ref={techRef} ex={ex} isAlternative={!!p.alternative?.active} feel={p.feel} onFeel={p.onFeel} note={p.note} onSaveNote={p.onSaveNote} showFeel={!complete} />
    </article>
  );
}
