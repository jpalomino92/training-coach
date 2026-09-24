/* Interruptor: role="switch" + aria-checked. El cambio se aplica al momento. */
import { useId } from 'react';

interface Props {
  eyebrow?: string;
  title: string;
  description: string;
  checked: boolean;
  onChange(v: boolean): void;
}

export function SwitchRow({ eyebrow, title, description, checked, onChange }: Props) {
  const t = useId(), d = useId();
  return (
    <div className="setrow">
      <div className="tx">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <b id={t}>{title}</b>
        <span id={d}>{description}</span>
      </div>
      <button type="button" role="switch" className="switch" aria-checked={checked} aria-labelledby={t} aria-describedby={d}
        onClick={() => onChange(!checked)} />
    </div>
  );
}
