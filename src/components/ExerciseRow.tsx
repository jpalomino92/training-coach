/* Fila plegada de 72 px en Hoy (siguiente, empezada o hecha). Tocarla abre el ejercicio. */
import { fmtNum, targetText } from '../domain/format';
import type { Exercise, Feel, WorkoutSet } from '../domain/types';
import { ExerciseIllustration } from './ExerciseIllustration';
import { FEEL_OPTIONS } from './FeelPicker';
import { Icon } from './Icon';

interface Props {
  ex: Exercise;
  number: number;
  sets: WorkoutSet[];
  feel?: Feel;
  onOpen(): void;
}

export function ExerciseRow({ ex, number, sets, feel, onOpen }: Props) {
  const done = sets.length >= ex.sets;
  const top = Math.max(0, ...sets.map(s => s.weight || 0));
  const feelLabel = FEEL_OPTIONS.find(o => o.value === feel)?.short;
  let sub: string;
  if (done) sub = ['✓ ' + `${sets.length} de ${ex.sets} series`, top > 0 ? `${fmtNum(top)} kg` : '', feelLabel || ''].filter(Boolean).join(' · ');
  else if (sets.length) sub = `◐ ${sets.length} de ${ex.sets} series`;
  else sub = `${targetText(ex)}${ex.unit === 's' ? '' : ` · RIR ${ex.rir}`}`;
  return (
    <button type="button" className={`xrow${done ? ' done' : sets.length ? ' part' : ''}`} onClick={onOpen} aria-label={`${number}. ${ex.name}. ${sub.replace('✓', 'Hecho:').replace('◐', 'Empezado:')}`}>
      {!done && <span className="n" aria-hidden="true">{number}</span>}
      <ExerciseIllustration pose={ex.pose} size="sm" imageSrc={ex.gifUrl} />
      <span className="tx" aria-hidden="true">
        <span className="t">{ex.name}</span>
        <span className="s">{sub}</span>
      </span>
      <Icon name="chevR" className="chev" />
    </button>
  );
}
