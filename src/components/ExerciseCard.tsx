/* Tarjeta del ejercicio activo en Hoy.
   Estados: activa con última sesión, sin datos previos y completa
   ("¿Cómo lo sentiste hoy?" + "Siguiente: …"). */
import { useEffect, useId, useRef, useState } from 'react';
import { fmtDate, restText, setText, targetText } from '../domain/format';
import { suggest } from '../domain/progression';
import { recordFor } from '../domain/records';
import { BARBELL_KEYS } from '../domain/plates';
import type { Exercise, Feel, Program, WorkoutSet } from '../domain/types';
import { lastSetAt, prefillFor, type LastSession as Last } from '../domain/workout';
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

  const sug = suggest(ex, last?.sets, p.program, p.lastFeel);
  const lastRef = (i: number) => { const s = lastSetAt(last, i); return s ? `Última vez: ${setText(ex, { ...s, rir: null })}` : undefined; };

  const rows = Array.from({ length: ex.sets }, (_, i) => {
    const saved = byIndex.get(i);
    if (i === current) {
      const mode = saved ? 'edit' : 'new';
      const initial = saved ? draftFrom(saved) : draftFrom(prefillFor(ex, i, sets, last));
      return (
        <SetEditor key={`${ex.key}-${i}-${mode}`} ex={ex} index={i} mode={mode} initial={initial} reference={lastRef(i)}
          barKg={BARBELL_KEYS.has(ex.key) ? p.barKg : undefined}
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
    if (saved) return <SetDone key={saved.id} set={saved} ex={ex} fresh={fresh?.id === saved.id} record={fresh?.id === saved.id ? fresh.record : undefined} onEdit={() => setEditing(i)} />;
    return <SetPending key={`p${i}`} index={i} />;
  });

  return (
    <article className={`xcard${complete ? ' complete' : ''}`} id={`ex-${p.anchor}`} aria-labelledby={`${feelId}-t`}>
      <div className="xhead">
        <ExerciseIllustration pose={ex.pose} size="lg" />
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
          <span className="chip">RIR {ex.rir}</span>
          <span className="chip"><Icon name="clock" />Descanso {restText(p.rest)}</span>
          <span className="chip">{ex.muscle}</span>
        </div>
      )}

      {!complete && p.alternative && !(p.alternative.locked && !p.alternative.active) && (
        <div className={`alt-switch${p.alternative.active ? ' on' : ''}`}>
          {p.alternative.active ? (
            <>
              <span>Estás haciendo la alternativa de <b>{p.alternative.baseName}</b>. Sus pesos se guardan aparte.</span>
              {!p.alternative.locked && <button type="button" className="btn btn-link" onClick={p.alternative.onToggle}>Volver a {p.alternative.baseName}</button>}
            </>
          ) : (
            <button type="button" className="btn btn-link" onClick={p.alternative.onToggle}>
              <Icon name="rutina" />¿Máquina ocupada? Hacer la alternativa: {p.alternative.altName}
            </button>
          )}
        </div>
      )}

      {!complete && (
        <div className="pair">
          <LastSession ex={ex} last={last} firstHint={sug.level === 'none' ? sug.reason : ''} />
          {sug.level !== 'none' && (
            <SuggestionBox s={sug} alternative={ex.alt} onShowAlternative={() => techRef.current?.showAlternative()}
              painDate={last ? fmtDate(last.workout.completed_at || last.workout.started_at) : undefined} />
          )}
        </div>
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
