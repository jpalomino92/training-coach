/* Tiempo de descanso con − / + de 15 s. */
import { useId } from 'react';
import { REST_MAX, REST_MIN, REST_STEP, restClock } from '../domain/prefs';
import { Icon } from './Icon';

export function RestStepper({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange(v: number): void }) {
  const id = useId();
  const set = (v: number) => onChange(Math.min(REST_MAX, Math.max(REST_MIN, v)));
  return (
    <div className="rest-row" role="group" aria-labelledby={`${id}-l`} aria-describedby={`${id}-h`}>
      <div className="tx">
        <b id={`${id}-l`}>{label}</b>
        <span id={`${id}-h`}>{hint}</span>
      </div>
      <div className="rest-stepper">
        <button type="button" className="step" onClick={() => set(value - REST_STEP)} aria-label={`Restar 15 segundos a ${label.toLowerCase()}`} aria-disabled={value <= REST_MIN || undefined}><Icon name="minus" /></button>
        <output aria-live="polite" aria-label={`${label}: ${restClock(value)}`}>{restClock(value)}</output>
        <button type="button" className="step" onClick={() => set(value + REST_STEP)} aria-label={`Sumar 15 segundos a ${label.toLowerCase()}`} aria-disabled={value >= REST_MAX || undefined}><Icon name="plus" /></button>
      </div>
    </div>
  );
}
