/* Peso con − / +. El paso se define por ejercicio (weightStep). Nunca baja de 0. */
import { forwardRef, useId } from 'react';
import { fmtNum, parseNum, round2 } from '../domain/format';
import { NumInput } from './Fields';
import { Icon } from './Icon';

interface Props {
  label?: string;
  value: string;
  step: number;
  onChange(v: string): void;
  error?: boolean;
  errorId?: string;
  big?: boolean;
  min?: number;
}

export const WeightStepper = forwardRef<HTMLInputElement, Props>(function WeightStepper(
  { label = 'Peso kg', value, step, onChange, error, errorId, big, min = 0 }, ref
) {
  const id = useId();
  const bump = (dir: 1 | -1) => {
    const cur = parseNum(value);
    const base = cur == null || Number.isNaN(cur) ? 0 : cur;
    onChange(fmtNum(Math.max(min, round2(base + dir * step))));
  };
  return (
    <div className="fl">
      <label htmlFor={id}>{label}</label>
      <div className={big ? 'stepper big' : 'stepper'}>
        <button type="button" className="step" onClick={() => bump(-1)} aria-label={`Restar ${fmtNum(step)} kg`}><Icon name="minus" /></button>
        <NumInput ref={ref} id={id} value={value} onChange={onChange} decimal error={error} errorId={errorId} />
        <button type="button" className="step" onClick={() => bump(1)} aria-label={`Sumar ${fmtNum(step)} kg`}><Icon name="plus" /></button>
      </div>
    </div>
  );
});
