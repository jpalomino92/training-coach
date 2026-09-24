/* Editar un ejercicio de una rutina propia: nombre, series, rango, RIR,
   descanso, incremento de peso, técnica, alternativa y precaución. */
import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { NumInput, TextField } from '../../components/Fields';
import { ExerciseIllustration } from '../../components/ExerciseIllustration';
import { Icon } from '../../components/Icon';
import { RestStepper } from '../../components/RestStepper';
import { Sheet } from '../../components/Sheet';
import { SwitchRow } from '../../components/Switch';
import { parseNum } from '../../domain/format';
import type { Exercise } from '../../domain/types';

const STEPS = [0.5, 1, 1.25, 2.5, 5];

export function TextArea({ label, value, onChange, hint, rows = 2, placeholder }: { label: string; value: string; onChange(v: string): void; hint?: string; rows?: number; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="inp" rows={rows} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} />
      {hint && <p className="hint" id={`${id}-h`}>{hint}</p>}
    </div>
  );
}

export function ExerciseEditor({ initial, onSave, onClose }: { initial: Exercise; onSave(e: Exercise): void; onClose(): void }) {
  const [ex, setEx] = useState<Exercise>(initial);
  const [sets, setSets] = useState(String(initial.sets));
  const [min, setMin] = useState(String(initial.reps.min));
  const [max, setMax] = useState(String(initial.reps.max));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setEx(e => ({ ...e, [k]: v }));
  const unitMax = ex.unit === 's' ? 600 : 50;

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const s = parseNum(sets), a = parseNum(min), b = parseNum(max);
    const err: Record<string, string> = {};
    if (!ex.name.trim()) err.name = 'Ponle un nombre.';
    if (s == null || !Number.isInteger(s) || s < 1 || s > 10) err.sets = 'Entre 1 y 10 series.';
    if (a == null || b == null || !Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > unitMax) {
      err.reps = ex.unit === 's' ? `Segundos entre 1 y ${unitMax}; el máximo no puede ser menor que el mínimo.` : `Repeticiones entre 1 y ${unitMax}; el máximo no puede ser menor que el mínimo.`;
    }
    if (!/^\d(-\d)?$/.test(ex.rir.trim())) err.rir = 'Un número o un rango, por ejemplo 2 o 2-3.';
    setErrors(err);
    if (Object.keys(err).length) return;
    onSave({ ...ex, name: ex.name.trim(), rir: ex.rir.trim(), sets: s!, reps: { min: a!, max: b! }, muscle: ex.muscle.trim(), cue: ex.cue.trim(), alt: ex.alt.trim(), warn: ex.warn.trim() });
  };

  return (
    <Sheet title="Editar ejercicio" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate aria-label="Editar ejercicio">
        <div className="ed-hero">
          <ExerciseIllustration pose={ex.pose} size="lg" imageSrc={ex.gifUrl} />
          {ex.exercisedbId && <p className="hint">Animación de ExerciseDB. El nombre original está en inglés: tradúcelo si quieres.</p>}
        </div>
        <TextField label="Nombre" value={ex.name} onChange={e => set('name', e.target.value)} error={errors.name} data-autofocus maxLength={80} />
        <TextField label="Músculo principal" value={ex.muscle} onChange={e => set('muscle', e.target.value)} maxLength={80} />

        <div className="ed-grid">
          <div className="fl">
            <label htmlFor="ed-sets">Series</label>
            <NumInput id="ed-sets" value={sets} onChange={setSets} error={!!errors.sets} errorId="ed-sets-e" />
          </div>
          <div className="fl">
            <label htmlFor="ed-min">{ex.unit === 's' ? 'Seg. mín.' : 'Reps mín.'}</label>
            <NumInput id="ed-min" value={min} onChange={setMin} error={!!errors.reps} errorId="ed-reps-e" />
          </div>
          <div className="fl">
            <label htmlFor="ed-max">{ex.unit === 's' ? 'Seg. máx.' : 'Reps máx.'}</label>
            <NumInput id="ed-max" value={max} onChange={setMax} error={!!errors.reps} errorId="ed-reps-e" />
          </div>
        </div>
        {errors.sets && <p id="ed-sets-e" className="err"><Icon name="alert" />{errors.sets}</p>}
        {errors.reps && <p id="ed-reps-e" className="err"><Icon name="alert" />{errors.reps}</p>}

        <div className="field">
          <span className="field-label" id="ed-unit">Se cuenta en</span>
          <div className="seg cols-2" role="group" aria-labelledby="ed-unit">
            <button type="button" aria-pressed={ex.unit === 'reps'} onClick={() => set('unit', 'reps')}>Repeticiones</button>
            <button type="button" aria-pressed={ex.unit === 's'} onClick={() => set('unit', 's')}>Segundos</button>
          </div>
        </div>

        <TextField label="RIR objetivo" value={ex.rir} onChange={e => set('rir', e.target.value)} error={errors.rir} narrow maxLength={3} inputMode="numeric"
          hint="Repeticiones en reserva al terminar la serie. Un número (2) o un rango (2-3)." />

        <RestStepper label="Descanso" hint="Entre series de este ejercicio." value={ex.rest} onChange={v => set('rest', v)} />

        <div className="field">
          <span className="field-label" id="ed-step">Incremento de peso</span>
          <div className="seg cols-5" role="group" aria-labelledby="ed-step" aria-describedby="ed-step-h">
            {STEPS.map(s => <button key={s} type="button" aria-pressed={ex.weightStep === s} onClick={() => set('weightStep', s)}>{String(s).replace('.', ',')}</button>)}
          </div>
          <p className="hint" id="ed-step-h">Kilos que suma o resta cada toque de − / + y lo que se sugiere subir.</p>
        </div>

        <div className="card">
          <SwitchRow title="Por lado" description="Las repeticiones se cuentan por cada lado." checked={ex.perSide} onChange={v => set('perSide', v)} />
          <SwitchRow title="Ejercicio básico" description="Usa el descanso de básicos si la persona personaliza los descansos." checked={ex.compound} onChange={v => set('compound', v)} />
        </div>

        <TextArea label="Técnica" value={ex.cue} onChange={v => set('cue', v)} placeholder="Ej.: espalda neutra, baja controlando." />
        <TextField label="Alternativa (si la máquina está ocupada)" value={ex.alt} onChange={e => set('alt', e.target.value)} maxLength={80} />
        <TextArea label="Precaución" value={ex.warn} onChange={v => set('warn', v)} hint="Se muestra resaltada en el ejercicio. Déjalo vacío si no hace falta." />

        <div className="btn-row">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit">Guardar ejercicio</Button>
        </div>
      </form>
    </Sheet>
  );
}
