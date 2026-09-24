/* Sugerencia de progresión: primero la acción en negrita y después el motivo.
   Nunca cambia el peso: la persona decide. Dolor tiene prioridad y role="alert". */
import type { Suggestion } from '../domain/progression';
import { Icon, type IconName } from './Icon';

const ICON: Record<Suggestion['level'], IconName> = { up: 'up', hold: 'equal', down: 'down', pain: 'bang', none: 'info' };
const CLS: Record<Suggestion['level'], string> = { up: 'up', hold: 'keep', down: 'down', pain: 'pain', none: 'none' };

interface Props {
  s: Suggestion;
  /** Fecha en que se registró el dolor (solo nivel pain). */
  painDate?: string;
  alternative?: string;
  onShowAlternative?(): void;
}

export function SuggestionBox({ s, painDate, alternative, onShowAlternative }: Props) {
  if (s.level === 'pain') {
    return (
      <div className="sug pain" role="alert">
        <div className="hd"><span className="ic"><Icon name="bang" /></span>Registraste dolor{painDate ? ` el ${painDate}` : ''}</div>
        <p><b>{s.action}</b> {s.reason}</p>
        {alternative && onShowAlternative && (
          <button type="button" className="btn btn-link" onClick={onShowAlternative}>Ver alternativa: {alternative.charAt(0).toLowerCase() + alternative.slice(1)}</button>
        )}
      </div>
    );
  }
  return (
    <div className={`sug ${CLS[s.level]}`}>
      <span className="ic"><Icon name={ICON[s.level]} /></span>
      <p><b>{s.action}</b> {s.reason}</p>
    </div>
  );
}
