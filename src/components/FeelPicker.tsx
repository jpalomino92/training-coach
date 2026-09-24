/* "¿Cómo lo sentiste hoy?": distingue molestia muscular normal de dolor
   articular, de espalda o neurológico. No diagnostica. */
import { PAIN_GUIDE } from '../domain/routines';
import type { Feel } from '../domain/types';

export const FEEL_OPTIONS: { value: Feel; label: string; short: string }[] = [
  { value: 'ok', label: 'Bien', short: 'Bien' },
  { value: 'muscle', label: 'Molestia muscular', short: 'Molestia muscular' },
  { value: 'pain', label: 'Dolor articular, de espalda o neurológico', short: 'Dolor' }
];

export function FeelPicker({ value, onChange, id }: { value?: Feel; onChange(v: Feel | null): void; id: string }) {
  return (
    <div className="feel" role="group" aria-labelledby={id}>
      <span className="eyebrow" id={id}>¿Cómo lo sentiste hoy?</span>
      <div className="seg feel-opts">
        {FEEL_OPTIONS.map(o => (
          <button key={o.value} type="button" className={o.value === 'pain' ? 'pain' : ''} aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? null : o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {value === 'pain' && <div className="alert pain-now" role="alert"><p>{PAIN_GUIDE.action}</p></div>}
    </div>
  );
}
