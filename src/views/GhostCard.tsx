/* Tarjeta del fantasma en Progreso: su humor, su nivel y tu racha ganándole. */
import { useMemo } from 'react';
import { GhostArt } from '../components/GhostArt';
import { resolveExercise } from '../domain/alternatives';
import { ghostStats, MOOD_TEXT } from '../domain/ghost';
import { isDeloadWorkout } from '../domain/stagnation';
import { useApp } from '../state/AppContext';

export function GhostCard() {
  const { data, lookup, prefs } = useApp();
  const stats = useMemo(() => ghostStats(data, w => key => resolveExercise(lookup(w.program_id), key), Date.now(), isDeloadWorkout(prefs)), [data, lookup, prefs]);
  if (!prefs.ghost) return null;
  const s = stats;
  const status = s.mood === 'sad'
    ? `Hace ${s.idleDays} días que no entrenas y se está desvaneciendo. Un entrenamiento lo devuelve a la vida.`
    : !s.lastWeek
      ? 'Todavía no hay con quién compararte. Aparece cuando repites un ejercicio de una semana anterior.'
      : `Última semana: le ganaste en ${s.lastWeek.wins} de ${s.lastWeek.total} ejercicios.`;
  return (
    <section className="card ghost-card" aria-labelledby="ghost-t">
      <GhostArt mood={s.mood} level={s.level} size="lg" />
      <div className="tx">
        <h2 className="h3" id="ghost-t">Rocky · nivel {s.level}</h2>
        <p className="ghost-quote">«{MOOD_TEXT[s.mood]}»</p>
        <p className="sm">{status}</p>
        <p className="xs muted">
          {s.streak > 0 ? `Racha: ${s.streak} ${s.streak === 1 ? 'semana' : 'semanas'} ganándole. ` : ''}
          Sube de nivel cada semana que le ganas: tu yo de hace un mes también se vuelve más fuerte.
        </p>
      </div>
    </section>
  );
}
