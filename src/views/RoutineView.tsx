/* RUTINA: semana tipo, días plegables con sus ejercicios y "Cómo entrenar". */
import { useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { DiscBadge } from '../components/DayDisc';
import { ExerciseIllustration } from '../components/ExerciseIllustration';
import { HealthNoticeFull } from '../components/HealthNotice';
import { Icon, type IconName } from '../components/Icon';
import { restText, targetText } from '../domain/format';
import { PAIN_GUIDE } from '../domain/routines';
import { totalSets } from '../domain/workout';
import { useApp } from '../state/AppContext';

const WEEKDAY_INDEX = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function Info({ icon, title, children, defaultOpen }: { icon: IconName; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const id = `info-${title.replace(/\W+/g, '-')}`;
  return (
    <section className="card info">
      <h3 style={{ margin: 0 }}>
        <button type="button" className="hd" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
          <span className="i"><Icon name={icon} /></span>{title}<Icon name={open ? 'chevU' : 'chevD'} />
        </button>
      </h3>
      <div id={id} className="body" hidden={!open}>{children}</div>
    </section>
  );
}

export function RoutineView() {
  const { program, setDayId, setTab, dayId } = useApp();
  const [openDay, setOpenDay] = useState<string | null>(dayId);
  const todayLetter = WEEKDAY_INDEX[new Date().getDay()];
  const dayOf = (id: string | null) => (id ? program.days.find(d => d.id === id) : undefined);

  return (
    <main className="screen">
      <div className="stack-sm">
        <span className="eyebrow">Tu rutina</span>
        <h1 className="h1">{program.shortName}</h1>
        <p className="lead">{program.description}</p>
        <p className="sm muted">{[program.name, `${program.daysPerWeek} días por semana`, program.level].filter(Boolean).join(' · ')}</p>
        {program.custom && program.coachName && <p className="sm"><Icon name="users" className="inline-ic" /> Asignada por {program.coachName}</p>}
      </div>

      {program.safety.requiresHealthNotice && <HealthNoticeFull safety={program.safety} />}

      <h2 className="sec eyebrow">Semana tipo</h2>
      <ul className="week" aria-label="Semana tipo">
        {program.weekPlan.map(([letter, id]) => {
          const d = dayOf(id);
          return (
            <li key={letter} className={letter === todayLetter ? 'today' : ''} aria-label={`${letter}: ${d ? `${d.id}, ${d.name}` : 'descanso o cardio suave'}${letter === todayLetter ? ' (hoy)' : ''}`}>
              <span aria-hidden="true">{letter}</span>
              {d ? <DiscBadge day={d} size={30} /> : <span className="rest" aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
      <p className="hint">Los días sin pesas son para cardio suave o descanso.</p>

      <h2 className="sec eyebrow">Días</h2>
      {program.days.map(d => {
        const open = openDay === d.id;
        const head = (
          <button type="button" className="drow" aria-expanded={open} aria-controls={`day-${d.id}`} onClick={() => setOpenDay(open ? null : d.id)}>
            <DiscBadge day={d} size={40} />
            <span className="tx">
              <span className="t">{d.name} — {d.focus}{d.optional ? ' (opcional)' : ''}</span>
              <span className="s">{d.exercises.length} ejercicios · {totalSets(d)} series</span>
            </span>
            <Icon name={open ? 'chevU' : 'chevD'} />
          </button>
        );
        if (!open) return <div key={d.id}>{head}</div>;
        return (
          <section key={d.id} className="dcard" data-day={d.color}>
            {head}
            <ul className="exl" id={`day-${d.id}`}>
              {d.exercises.map(ex => (
                <li key={ex.key}>
                  <ExerciseIllustration pose={ex.pose} size="xs" imageSrc={ex.gifUrl} />
                  <span>{ex.name}<br /><span className="xs muted">RIR {ex.rir} · descanso {restText(ex.rest)}</span></span>
                  <span className="tgt">{targetText(ex)}</span>
                </li>
              ))}
            </ul>
            <Button variant="primary" block onClick={() => { setDayId(d.id); setTab('hoy'); }}>Entrenar este día</Button>
          </section>
        );
      })}

      <h2 className="sec eyebrow">Cómo entrenar</h2>
      <Info icon="progreso" title="Intensidad y progresión">
        {program.intensity && <p>{program.intensity}</p>}
        <p>Doble progresión: cuando completes el máximo del rango en todas las series con al menos RIR {program.progression.minRirToProgress}, la app te sugerirá subir {program.progression.step}. El peso nunca cambia solo: tú decides.</p>
        <p className="sm muted">RIR son las repeticiones que te quedan en reserva al terminar la serie. RIR 2 significa que podrías haber hecho 2 más con buena técnica.</p>
      </Info>
      <Info icon="alert" title="Molestia normal o dolor" defaultOpen>
        <div className="pain-cmp">
          <div className="ok"><b><Icon name="check" />Normal</b><span>{PAIN_GUIDE.normal}</span></div>
          <div className="stop"><b><Icon name="bang" />Para y no sigas</b><span>{PAIN_GUIDE.stop}</span></div>
        </div>
        <p>{PAIN_GUIDE.action}</p>
      </Info>
      {program.cardio && <Info icon="clock" title="Cardio"><p>{program.cardio}</p></Info>}
      {!program.safety.requiresHealthNotice && program.safety.warnings.length > 0 && (
        <Info icon="info" title="Precauciones"><ul>{program.safety.warnings.map(w => <li key={w}>{w}</li>)}</ul></Info>
      )}
      {program.tips.length > 0 && <Info icon="rutina" title="Consejos"><ul>{program.tips.map(t => <li key={t}>{t}</li>)}</ul></Info>}
    </main>
  );
}
