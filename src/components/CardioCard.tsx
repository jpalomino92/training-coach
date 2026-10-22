/* Cardio final en Hoy: elegir máquina y minutos, encadenar tramos y terminar el entrenamiento. */
import { useId, useState, type FormEvent } from 'react';
import { CARDIO_MACHINES, cardioMachine } from '../domain/cardio';
import { parseNum } from '../domain/format';
import type { Exercise, WorkoutSet } from '../domain/types';
import { Button } from './Button';
import { ExerciseIllustration } from './ExerciseIllustration';
import { FieldError, NumberField } from './Fields';
import { Icon } from './Icon';

interface Props {
  slot: Exercise;
  number: number;
  total: number;
  /** Tramos registrados hoy. */
  segments: WorkoutSet[];
  /** Máquina con la que se empieza (la última que se usó). */
  defaultMachine: string;
  /** Minutos de la última vez en cada máquina. */
  lastMinutes(machineKey: string): number | null;
  onAdd(machineKey: string, minutes: number): Promise<void>;
  onDelete(set: WorkoutSet): Promise<void>;
  /** Terminar el entrenamiento (solo si sigue en curso). */
  onFinish?(): void;
  finishing?: boolean;
}

export function CardioCard(p: Props) {
  const [machine, setMachine] = useState(p.defaultMachine);
  const [minutes, setMinutes] = useState(() => String(p.lastMinutes(p.defaultMachine) ?? ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = useId();
  const done = p.segments.length > 0;
  const totalMin = p.segments.reduce((n, s) => n + s.reps, 0);

  const pick = (key: string) => {
    setMachine(key);
    const last = p.lastMinutes(key);
    if (last != null) setMinutes(String(last));
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const m = parseNum(minutes);
    if (m == null || Number.isNaN(m) || !Number.isInteger(m) || m < 1 || m > 120) { setError('Escribe los minutos (entre 1 y 120).'); return; }
    setError('');
    setBusy(true);
    try { await p.onAdd(machine, m); } finally { setBusy(false); }
  };

  return (
    <article className={`xcard${done ? ' complete' : ''}`} id={`ex-${p.slot.key}`} aria-labelledby={`${id}-t`}>
      <div className="xhead">
        <ExerciseIllustration pose={cardioMachine(machine)?.pose || p.slot.pose} size="lg" />
        <div className="tx">
          {done
            ? <span className="done-head"><Icon name="check" />{totalMin} min de cardio</span>
            : <span className="num">Ejercicio {p.number} de {p.total}</span>}
          <h3 className="h3" id={`${id}-t`}>{p.slot.name}</h3>
        </div>
      </div>
      <p className="sm">{p.slot.cue}</p>

      {done && (
        <ul className="sets cardio-list" aria-label="Tramos de cardio">
          {p.segments.map(s => (
            <li key={s.id} className="set-done">
              <span className="ck" aria-hidden="true"><Icon name="check" /></span>
              <span className="tx"><b>{cardioMachine(s.exercise_key)?.name || s.exercise_key}</b> · {s.reps} min</span>
              <button type="button" className="btn btn-link" onClick={() => p.onDelete(s)} aria-label={`Borrar ${cardioMachine(s.exercise_key)?.name} ${s.reps} min`}>Borrar</button>
            </li>
          ))}
        </ul>
      )}

      <form className="set-edit" onSubmit={add} noValidate aria-label={done ? 'Añadir otra máquina' : 'Añadir cardio'}>
        <div className="top"><span className="eyebrow">{done ? 'Añadir otra máquina' : 'Máquina y minutos'}</span></div>
        <div className="two">
          <div className="fl">
            <label htmlFor={`${id}-m`}>Máquina</label>
            <select id={`${id}-m`} className="inp cardio-select" value={machine} onChange={e => pick(e.target.value)}>
              {CARDIO_MACHINES.map(m => <option key={m.key} value={m.key}>{m.name}</option>)}
            </select>
          </div>
          <NumberField label="Min" value={minutes} onChange={setMinutes} error={!!error} errorId={`${id}-e`} />
        </div>
        <FieldError id={`${id}-e`}>{error}</FieldError>
        <Button variant={done ? 'secondary' : 'primary'} block type="submit" icon="plus" loading={busy}>
          Añadir {cardioMachine(machine)?.name.toLowerCase()}
        </Button>
      </form>

      {done && p.onFinish && (
        <Button variant="primary" block icon="check" onClick={p.onFinish} loading={p.finishing}>Terminar entrenamiento</Button>
      )}
    </article>
  );
}
