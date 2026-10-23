/* Ventana al terminar el entrenamiento: "Levantaste 2 morsas" y el resumen. */
import { animalFor } from '../domain/animals';
import { resolveExercise } from '../domain/alternatives';
import { ghostStats, moodFor, workoutVersus } from '../domain/ghost';
import { isDeloadWorkout } from '../domain/stagnation';
import { GhostArt } from './GhostArt';
import { fmtThousands, fmtMinutes, KG_PER_BLOCK, volumeText, workoutSummary } from '../domain/summary';
import type { Workout } from '../domain/types';
import { useApp } from '../state/AppContext';
import { AnimalArt } from './AnimalArt';
import { Button } from './Button';
import { Sheet } from './Sheet';

export function WorkoutDoneSheet({ workout, onClose }: { workout: Workout; onClose(): void }) {
  const { data, lookup, prefs } = useApp();
  const s = workoutSummary(data, workout, lookup);
  const program = lookup(workout.program_id);
  const skip = isDeloadWorkout(prefs);
  // En semana de descarga no se compara con el fantasma
  const vs = prefs.ghost && !skip(workout) ? workoutVersus(data, workout, key => resolveExercise(program, key), skip) : null;
  const stats = vs && vs.total > 0 ? ghostStats(data, w => key => resolveExercise(lookup(w.program_id), key), Date.now(), skip) : null;
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
        {vs && vs.total > 0 && stats && (
          <div className="cel-ghost-pet">
            <GhostArt mood={moodFor(vs.wins, vs.total - vs.wins - vs.ties, vs.total)} level={stats.level} speech />
            <span className="xs muted">Fantasma nivel {stats.level}{stats.streak > 1 ? ` · ${stats.streak} semanas seguidas ganándole` : ''}</span>
          </div>
        )}
        {vs && vs.total > 0 && (
          <p className="cel-ghost">{vs.wins === vs.total
            ? `¡Le ganaste a tu fantasma en todos los ejercicios (${vs.total})!`
            : `Le ganaste a tu fantasma en ${vs.wins} de ${vs.total} ejercicios${vs.ties ? ` (${vs.ties} empate${vs.ties === 1 ? '' : 's'})` : ''}.`}</p>
        )}
      </div>
      <dl className="cel-sum">
        <span className="eyebrow">Resumen del entrenamiento</span>
        <div><dt>Duración</dt><dd>{s.minutes != null ? fmtMinutes(s.minutes) : '—'}</dd></div>
        <div><dt>Series</dt><dd>{s.sets} de {s.total}</dd></div>
        <div><dt>Total levantado</dt><dd>{s.volume > 0 ? volumeText(s.volume, s.approx) : '—'}</dd></div>
        {s.records.length > 0 && <div><dt>{s.records.length === 1 ? 'Récord' : 'Récords'}</dt><dd>{s.records.length}</dd></div>}
        {vs && vs.total > 0 && <div><dt>Contra tu fantasma</dt><dd>{vs.wins} de {vs.total}</dd></div>}
      </dl>
      <Button variant="primary" block onClick={onClose} data-autofocus>Listo</Button>
    </Sheet>
  );
}
