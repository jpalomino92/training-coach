/* Filas de serie: pendiente, editable (nueva o corrigiendo una registrada) y registrada. */
import { useId, useRef, useState, type FormEvent } from 'react';
import { fmtNum, parseNum, repLabel, setText } from '../domain/format';
import type { Exercise, WorkoutSet } from '../domain/types';
import { Button } from './Button';
import { FieldError, NumberField } from './Fields';
import { Icon } from './Icon';
import { WeightStepper } from './WeightStepper';

export function SetPending({ index }: { index: number }) {
  return <div className="set-todo">Serie {index + 1} · pendiente</div>;
}

export function SetDone({ set, ex, fresh, record, onEdit }: { set: WorkoutSet; ex: Exercise; fresh?: boolean; record?: string; onEdit(): void }) {
  return (
    <div className={`set-done${fresh ? ' fresh' : ''}${fresh && record ? ' pr' : ''}`}>
      <span className="ck" aria-hidden="true"><Icon name={fresh && record ? 'trophy' : 'check'} /></span>
      {fresh ? (
        <span className="tx" role="status"><b>✓ Serie registrada</b><br />{setText(ex, set)}{record && <><br /><b className="pr-text">{record}</b></>}</span>
      ) : (
        <span className="tx"><b>Serie {set.set_index + 1}</b> · {setText(ex, set)}</span>
      )}
      <button type="button" className="btn btn-link" onClick={onEdit} aria-label={`Editar serie ${set.set_index + 1}`}>Editar</button>
    </div>
  );
}

export interface SetDraft { weight: string; reps: string; rir: string }

export const draftFrom = (v: { weight: number | null; reps: number | null; rir: number | null }): SetDraft => ({
  weight: v.weight == null ? '' : fmtNum(v.weight),
  reps: v.reps == null ? '' : String(v.reps),
  rir: v.rir == null ? '' : fmtNum(v.rir)
});

type Errors = Partial<Record<'weight' | 'reps' | 'rir', string>>;

/** Valida al pulsar Completar: reps 1–50 (segundos 1–600), RIR 0–5, peso 0–500. */
export function validateSet(ex: Exercise, d: SetDraft): { errors: Errors; values?: { weight: number | null; reps: number; rir: number | null } } {
  const errors: Errors = {};
  const maxReps = ex.unit === 's' ? 600 : 50;
  const reps = parseNum(d.reps);
  const weight = parseNum(d.weight);
  const rir = parseNum(d.rir);
  if (reps == null || Number.isNaN(reps) || !Number.isInteger(reps) || reps < 1 || reps > maxReps) {
    errors.reps = ex.unit === 's'
      ? `Escribe cuántos segundos aguantaste (entre 1 y ${maxReps}).`
      : `Escribe cuántas repeticiones hiciste (entre 1 y ${maxReps}).`;
  }
  if (weight != null && (Number.isNaN(weight) || weight < 0 || weight > 500)) errors.weight = 'El peso tiene que ser un número entre 0 y 500, por ejemplo 12,5.';
  if (rir != null && (Number.isNaN(rir) || rir < 0 || rir > 5)) errors.rir = 'El RIR es un número entre 0 y 5.';
  if (Object.keys(errors).length) return { errors };
  return { errors, values: { weight: weight || weight === 0 ? weight : null, reps: reps!, rir } };
}

interface EditProps {
  ex: Exercise;
  index: number;
  mode: 'new' | 'edit';
  initial: SetDraft;
  /** "Última vez: 40 kg × 10" */
  reference?: string;
  onSubmit(v: { weight: number | null; reps: number; rir: number | null }): Promise<void>;
  onCancel?(): void;
  onDelete?(): Promise<void>;
}

export function SetEditor({ ex, index, mode, initial, reference, onSubmit, onCancel, onDelete }: EditProps) {
  const [d, setD] = useState<SetDraft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const errId = useId();
  const repsRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const rirRef = useRef<HTMLInputElement>(null);
  const firstError = errors.reps || errors.weight || errors.rir;
  const empty = !d.reps.trim() && !d.weight.trim();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const r = validateSet(ex, d);
    setErrors(r.errors);
    if (!r.values) {
      (r.errors.reps ? repsRef : r.errors.weight ? weightRef : rirRef).current?.focus();
      return;
    }
    setBusy(true);
    try { await onSubmit(r.values); } finally { setBusy(false); }
  };

  const del = async () => {
    if (!onDelete || busy) return;
    setBusy(true);
    try { await onDelete(); } finally { setBusy(false); }
  };

  const title = mode === 'edit' ? `Editar serie ${index + 1}` : `Serie ${index + 1} de ${ex.sets}`;
  return (
    <form className="set-edit" onSubmit={submit} noValidate aria-label={title}>
      <div className="top">
        <span className="eyebrow">{title}</span>
        {mode === 'edit'
          ? <button type="button" className="btn btn-link danger-link" onClick={del}>Eliminar serie</button>
          : reference && <span className="muted">{reference}</span>}
      </div>
      <div className="w"><WeightStepper ref={weightRef} value={d.weight} step={ex.weightStep} onChange={v => setD({ ...d, weight: v })} error={!!errors.weight} errorId={errId} /></div>
      <div className="two">
        <NumberField ref={repsRef} label={repLabel(ex)} value={d.reps} onChange={v => setD({ ...d, reps: v })} error={!!errors.reps} errorId={errId} />
        <NumberField ref={rirRef} label="RIR" value={d.rir} onChange={v => setD({ ...d, rir: v })} error={!!errors.rir} errorId={errId} decimal />
      </div>
      <FieldError id={errId}>{firstError}</FieldError>
      {mode === 'edit' ? (
        <div className="btn-row act">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" type="submit" loading={busy}>Guardar</Button>
        </div>
      ) : (
        <div className="act"><Button variant="primary" block type="submit" icon="check" loading={busy}
          disabledReason={empty ? (ex.unit === 's' ? 'Escribe los segundos' : 'Escribe el peso y las repeticiones') : null} showReason>
          Completar serie
        </Button></div>
      )}
    </form>
  );
}
