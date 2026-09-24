/* Disco de día (como un disco olímpico). Marca de estado abajo a la derecha:
   vacía (no iniciado), a medias (en progreso) o ✓ verde (completado). */
import type { CSSProperties } from 'react';
import type { WorkoutDay } from '../domain/types';
import type { DayStatus } from '../domain/workout';
import { HalfIcon, Icon } from './Icon';

export const STATUS_TEXT: Record<DayStatus, string> = { none: 'no iniciado', prog: 'en progreso', done: 'completado' };

export function StatusMark({ status }: { status: DayStatus }) {
  return (
    <span className={`mk ${status}`} aria-hidden="true">
      {status === 'done' && <Icon name="check" />}
      {status === 'prog' && <HalfIcon className="half" />}
    </span>
  );
}

interface Props {
  day: Pick<WorkoutDay, 'id' | 'color' | 'name' | 'focus'>;
  status?: DayStatus;
  selected?: boolean;
  onSelect?(): void;
  size?: number;
  className?: string;
}

/** Botón en el selector de Hoy. */
export function DayDisc({ day, status, selected, onSelect, size, className }: Props) {
  const style: CSSProperties | undefined = size ? { width: size, height: size, fontSize: Math.round(size / 2.95) } : undefined;
  const label = `${day.id}, ${day.name} — ${day.focus}${status ? `, ${STATUS_TEXT[status]}` : ''}`;
  return (
    <button type="button" className={`disc dc-${day.color} ${className || ''}`} style={style} onClick={onSelect}
      aria-current={selected ? 'true' : undefined} aria-label={label}>
      <span aria-hidden="true">{day.id}</span>
      {status && <StatusMark status={status} />}
    </button>
  );
}

/** Disco decorativo (listas, miniaturas). */
export function DiscBadge({ day, size, status }: { day: Pick<WorkoutDay, 'id' | 'color'>; size?: number; status?: DayStatus }) {
  const style: CSSProperties | undefined = size ? { width: size, height: size, fontSize: Math.round(size / 2.6) } : undefined;
  return (
    <span className={`disc dc-${day.color}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }} aria-hidden="true">
      {day.id}
      {status && <StatusMark status={status} />}
    </span>
  );
}
