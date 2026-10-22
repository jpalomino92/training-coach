/* Ventana al terminar el entrenamiento: "Levantaste 2 morsas" y el resumen. */
import { animalFor } from '../domain/animals';
import { fmtThousands, fmtMinutes, KG_PER_BLOCK, volumeText, workoutSummary } from '../domain/summary';
import type { Workout } from '../domain/types';
import { useApp } from '../state/AppContext';
import { AnimalArt } from './AnimalArt';
import { Button } from './Button';
import { Sheet } from './Sheet';

export function WorkoutDoneSheet({ workout, onClose }: { workout: Workout; onClose(): void }) {
  const { data, lookup } = useApp();
  const s = workoutSummary(data, workout, lookup);
  const match = animalFor(s.volume);
  return (
    <Sheet title="Entrenamiento completado" onClose={onClose} closeLabel="Cerrar" className="celebrate">
      {match && <AnimalArt id={match.animal.id} />}
      <div className="cel-text">
        <p className="cel-title">¡Felicidades!{match && <><br />Levantaste <b>{match.text}</b></>}</p>
        {match ? (
          <p className="cel-sub">
            Levantaste {volumeText(s.volume, s.approx)} en este entrenamiento. {match.animal.article} {match.animal.one} pesa {fmtThousands(match.animal.kg)} kg de media.
            {s.approx && <> Cada bloque de máquina cuenta como {KG_PER_BLOCK} kg.</>}
          </p>
        ) : (
          <p className="cel-sub">Has terminado {s.sets} {s.sets === 1 ? 'serie' : 'series'}. ¡Buen trabajo!</p>
        )}
      </div>
      <dl className="cel-sum">
        <span className="eyebrow">Resumen del entrenamiento</span>
        <div><dt>Duración</dt><dd>{s.minutes != null ? fmtMinutes(s.minutes) : '—'}</dd></div>
        <div><dt>Series</dt><dd>{s.sets} de {s.total}</dd></div>
        <div><dt>Total levantado</dt><dd>{s.volume > 0 ? volumeText(s.volume, s.approx) : '—'}</dd></div>
        {s.records.length > 0 && <div><dt>{s.records.length === 1 ? 'Récord' : 'Récords'}</dt><dd>{s.records.length}</dd></div>}
      </dl>
      <Button variant="primary" block onClick={onClose} data-autofocus>Listo</Button>
    </Sheet>
  );
}
