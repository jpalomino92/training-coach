/* PROGRESO: ejercicios (un punto por semana con el peso máximo) y peso corporal. */
import { useState } from 'react';
import { Button } from '../components/Button';
import { Sparkline } from '../components/Charts';
import { ExerciseIllustration } from '../components/ExerciseIllustration';
import { fmtDate, fmtNum, DAY_MS, toDate } from '../domain/format';
import { streak, weeklyCounts, weeklyGoal } from '../domain/consistency';
import { exerciseProgress, type ExerciseProgress } from '../domain/workout';
import { useApp } from '../state/AppContext';
import { BodyWeightPanel } from './BodyWeightPanel';

function ProgressCard({ p }: { p: ExerciseProgress }) {
  const unit = p.loaded ? ' kg' : p.ex.unit === 's' ? ' s' : ' reps';
  const v = (n: number) => `${fmtNum(n)}${unit}`;
  const first = p.weeks[0], last = p.weeks[p.weeks.length - 1];
  const trend = last[1] > first[1] ? 'sube' : last[1] < first[1] ? 'baja' : 'se mantiene';
  return (
    <section className="card pc" data-day={p.day.color} aria-label={p.ex.name}>
      <div className="top">
        <ExerciseIllustration pose={p.ex.pose} size="md" />
        <div className="tx"><h3 className="t" style={{ margin: 0 }}>{p.ex.name}</h3><span className="s">{p.isAlternative ? `Alternativa de ${p.ex.alt} · ` : ''}{p.day.name} — {p.day.focus}</span></div>
      </div>
      <div className="g">
        <div className="stat"><b>{v(p.last)}</b><span>{p.loaded ? 'Último peso' : 'Última marca'}</span></div>
        <div className="stat"><b>{v(p.max)}</b><span>{p.loaded ? 'Peso máximo' : 'Mejor marca'}</span></div>
      </div>
      {p.weeks.length >= 2 ? (
        <Sparkline points={p.weeks.map(([w, n]) => ({ x: w, y: n, label: `Semana ${w} · ${v(n)}` }))}
          summary={`${p.ex.name}: ${trend}, de ${v(first[1])} en la semana ${first[0]} a ${v(last[1])} en la semana ${last[0]}.`} />
      ) : (
        <p className="need">Necesitas 2 semanas de datos para ver la evolución.</p>
      )}
      <div className="evo">
        <span>Semana {first[0]} → <b>{v(first[1])}</b></span>
        {p.weeks.length >= 2 && <span>Semana {last[0]} → <b>{v(last[1])}</b></span>}
      </div>
    </section>
  );
}

/** Constancia: entrenamientos completados en las últimas 8 semanas frente al objetivo semanal. */
function Consistency() {
  const { data, program } = useApp();
  const goal = weeklyGoal(program);
  const weeks = weeklyCounts(data.workouts, 8);
  const run = streak(data.workouts, goal);
  const max = Math.max(goal, ...weeks.map(w => w.count));
  const label = (start: string) => { const [, m, d] = start.split('-'); return `${d}/${m}`; };
  return (
    <section className="card consistency" aria-labelledby="cons-t">
      <div className="hd">
        <h2 className="h3" id="cons-t">Constancia</h2>
        <span className="sm muted">Objetivo: {goal} por semana</span>
      </div>
      <p className="sm">{run > 0 ? <>Racha: <b>{run} {run === 1 ? 'semana' : 'semanas'}</b> cumpliendo el objetivo.</> : 'Completa tu objetivo esta semana para empezar una racha.'}</p>
      <ol className="bars" aria-label="Entrenamientos completados por semana">
        {weeks.map((w, i) => (
          <li key={w.start} className={w.count >= goal ? 'met' : ''} aria-label={`Semana del ${label(w.start)}: ${w.count} de ${goal}${w.count >= goal ? ', objetivo cumplido' : ''}`}>
            <span className="bar-v" style={{ height: `${(w.count / max) * 100}%` }} aria-hidden="true" />
            <span className="n" aria-hidden="true">{w.count}</span>
            <span className="d" aria-hidden="true">{i === weeks.length - 1 ? 'Esta' : label(w.start)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProgressView() {
  const { data, program, profile, setTab } = useApp();
  const [view, setView] = useState<'ex' | 'bw'>('ex');
  const [filter, setFilter] = useState<string | null>(null);
  if (!profile) return null;
  const showBw = profile.show_body_weight;
  const current = showBw ? view : 'ex';
  const items = exerciseProgress(data, program, profile.start_date, filter);
  const completed = data.workouts.filter(w => w.status === 'completed').length;
  const weeks = Math.max(1, Math.floor((Date.now() - +toDate(profile.start_date)) / (7 * DAY_MS)) + 1);
  const anyData = exerciseProgress(data, program, profile.start_date).length > 0;

  return (
    <main className="screen">
      <h1 className="h1">Progreso</h1>
      {showBw && (
        <div className="view" role="group" aria-label="Qué ver">
          <button type="button" aria-pressed={current === 'ex'} onClick={() => setView('ex')}>Ejercicios</button>
          <button type="button" aria-pressed={current === 'bw'} onClick={() => setView('bw')}>Peso corporal</button>
        </div>
      )}

      {current === 'bw' ? <BodyWeightPanel /> : !anyData ? (
        <div className="card empty">
          <ExerciseIllustration pose="squat" size="lg" />
          <h2 className="h3">Aún no hay progreso</h2>
          <p className="muted">Cuando completes tu primer entrenamiento, aquí verás cómo cambian tus pesos semana a semana.</p>
          <Button variant="primary" onClick={() => setTab('hoy')}>Ir a Hoy</Button>
        </div>
      ) : (
        <>
          <div className="tiles">
            <div className="card tile"><b>{completed}</b><span>{completed === 1 ? 'entrenamiento completado' : 'entrenamientos completados'}</span></div>
            <div className="card tile"><b>{weeks}</b><span>{weeks === 1 ? 'semana' : 'semanas'} desde el inicio</span><span className="xs muted">{fmtDate(profile.start_date)}</span></div>
          </div>
          <Consistency />
          <div className="filters" role="group" aria-label="Filtrar por día">
            <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>Todos</button>
            {program.days.map(d => (
              <button key={d.id} type="button" aria-pressed={filter === d.id} onClick={() => setFilter(d.id)} aria-label={`${d.id}, ${d.name}`}>
                <span className={`dotc dc-${d.color}`} aria-hidden="true" />{d.id}
              </button>
            ))}
          </div>
          <h2 className="sec eyebrow">Por ejercicio</h2>
          {items.length ? items.map(p => <ProgressCard key={p.ex.key} p={p} />) : (
            <p className="need">Todavía no hay series registradas en este día.</p>
          )}
        </>
      )}
    </main>
  );
}
