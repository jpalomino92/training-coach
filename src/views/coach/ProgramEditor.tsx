/* ==========================================================
   Editor de rutinas propias del entrenador.
   Datos generales, progresión, aviso de salud opcional, semana tipo
   y días con sus ejercicios. Se valida antes de guardar.
   ========================================================== */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { DiscBadge } from '../../components/DayDisc';
import { ExerciseIllustration } from '../../components/ExerciseIllustration';
import { TextField } from '../../components/Fields';
import { Icon } from '../../components/Icon';
import { SwitchRow } from '../../components/Switch';
import { DAY_COLORS, blankDay, normalizeProgram, uniqueKey, validateProgram, type ProgramIssue } from '../../domain/customProgram';
import { targetText } from '../../domain/format';
import type { DayColor, Exercise, Program } from '../../domain/types';
import { useApp } from '../../state/AppContext';
import { ExerciseEditor, TextArea } from './ExerciseEditor';
import { ExercisePicker } from './ExercisePicker';

const COLOR_NAMES: Record<DayColor, string> = { red: 'Rojo', blue: 'Azul', yellow: 'Amarillo', green: 'Verde', black: 'Negro' };
const WEEK_LETTERS: [string, string][] = [['L', 'Lunes'], ['M', 'Martes'], ['X', 'Miércoles'], ['J', 'Jueves'], ['V', 'Viernes'], ['S', 'Sábado'], ['D', 'Domingo']];

const lines = (a: string[] | undefined) => (a || []).join('\n');
const toLines = (s: string) => s.split('\n');
function move<T>(list: T[], i: number, by: number): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

interface Props { initial: Program; isNew: boolean; onClose(): void; onSaved(p: Program): void }

export function ProgramEditor({ initial, isNew, onClose, onSaved }: Props) {
  const { coachApi, coach, showToast } = useApp();
  const [p, setP] = useState<Program>(initial);
  const [issues, setIssues] = useState<ProgramIssue[]>([]);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const [editEx, setEditEx] = useState<{ day: number; index: number; ex: Exercise } | null>(null);
  const [confirmDay, setConfirmDay] = useState<number | null>(null);
  const issuesRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(p) !== JSON.stringify(initial);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const up = (fn: (q: Program) => void) => setP(prev => { const q = structuredClone(prev); fn(q); return q; });
  const plan = normalizeProgram(p).weekPlan;

  const save = async () => {
    const q = normalizeProgram({ ...p, coachName: coach?.displayName || p.coachName });
    const found = validateProgram(q);
    setIssues(found);
    if (found.length) { requestAnimationFrame(() => issuesRef.current?.focus()); return; }
    setBusy(true);
    try {
      const saved = await coachApi!.saveProgram(q);
      showToast(`"${saved.shortName}" guardada. Tus alumnos la verán al abrir la app.`);
      onSaved(saved);
    } catch (e) {
      setBusy(false);
      showToast((e instanceof Error ? e.message : '') || 'No se pudo guardar la rutina.');
    }
  };

  const addExercise = (dayIdx: number, ex: Exercise) => {
    const day = p.days[dayIdx];
    const item = { ...ex, key: uniqueKey(ex.key, day) };
    up(q => { q.days[dayIdx].exercises.push(item); });
    setPicker(null);
    setEditEx({ day: dayIdx, index: day.exercises.length, ex: item });
  };

  const hasIssue = (prefix: string) => issues.some(i => i.path === prefix || i.path.startsWith(prefix + '.'));

  return (
    <main className="screen coach editor">
      {!leaving ? (
        <button type="button" className="back" onClick={() => (dirty ? setLeaving(true) : onClose())}><Icon name="chevL" />Rutinas</button>
      ) : (
        <div className="confirm" role="group" aria-labelledby="leave-ed">
          <p id="leave-ed"><b>Tienes cambios sin guardar.</b> ¿Salir y descartarlos?</p>
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setLeaving(false)} autoFocus>Seguir editando</Button>
            <Button variant="danger" onClick={onClose}>Descartar</Button>
          </div>
        </div>
      )}
      <div className="stack-sm">
        <span className="eyebrow">{isNew ? 'Nueva rutina' : 'Editar rutina'}</span>
        <h1 className="h1" tabIndex={-1} ref={titleRef}>{p.shortName || p.name || 'Rutina sin nombre'}</h1>
      </div>

      {issues.length > 0 && (
        <div className="alert issues" role="alert" tabIndex={-1} ref={issuesRef}>
          <Icon name="alert" />
          <div><p><b>Revisa {issues.length === 1 ? 'esto' : `estos ${issues.length} puntos`} antes de guardar:</b></p><ul>{issues.map(i => <li key={i.path + i.message}>{i.message}</li>)}</ul></div>
        </div>
      )}

      <section className="card card-pad stack" aria-labelledby="ed-gen">
        <h2 className="eyebrow" id="ed-gen">Datos generales</h2>
        <TextField label="Nombre" value={p.name} maxLength={80} error={hasIssue('name') ? 'Ponle un nombre a la rutina.' : undefined}
          onChange={e => { const v = e.target.value; up(q => { const same = q.shortName === q.name; q.name = v; if (same) q.shortName = v; }); }} />
        <TextField label="Nombre corto" value={p.shortName} maxLength={40} hint="Es el que se ve en Hoy y en Rutina." onChange={e => { const v = e.target.value; up(q => { q.shortName = v; }); }} />
        <TextArea label="Descripción" value={p.description} rows={3} onChange={v => up(q => { q.description = v; })} placeholder="Para quién es y qué busca." />
        <div className="two">
          <TextField label="Nivel" value={p.level} maxLength={40} placeholder="Ej.: principiante" onChange={e => { const v = e.target.value; up(q => { q.level = v; }); }} />
          <TextField label="Para quién" value={p.audience} maxLength={60} placeholder="Ej.: rodilla operada" onChange={e => { const v = e.target.value; up(q => { q.audience = v; }); }} />
        </div>
        <TextArea label="Intensidad" value={p.intensity} onChange={v => up(q => { q.intensity = v; })} placeholder="Ej.: termina cada serie con 2 repeticiones en reserva." />
        <TextArea label="Cardio" value={p.cardio} onChange={v => up(q => { q.cardio = v; })} placeholder="Ej.: 20-30 min de caminata los días sin pesas." />
        <TextArea label="Consejos (uno por línea)" value={lines(p.tips)} rows={3} onChange={v => up(q => { q.tips = toLines(v); })} />
      </section>

      <section className="card card-pad stack" aria-labelledby="ed-prog">
        <h2 className="eyebrow" id="ed-prog">Progresión</h2>
        <div className="field">
          <span className="field-label" id="ed-rir">Sugerir subir peso con RIR de al menos</span>
          <div className="seg cols-4" role="group" aria-labelledby="ed-rir">
            {[0, 1, 2, 3].map(n => <button key={n} type="button" aria-pressed={p.progression.minRirToProgress === n} onClick={() => up(q => { q.progression.minRirToProgress = n; })}>{n}</button>)}
          </div>
          <p className="hint">Cuando complete el máximo del rango en todas las series con este RIR o más, la app le sugerirá subir. Nunca cambia el peso sola.</p>
        </div>
        <div className="card flat">
          <SwitchRow title="Progresión prudente" checked={p.progression.cautious} onChange={v => up(q => { q.progression.cautious = v; })}
            description="Sugiere mantener o bajar si la serie quedó muy dura (RIR menor de 2). Útil tras una lesión." />
        </div>
      </section>

      <section className="card card-pad stack" aria-labelledby="ed-safe">
        <h2 className="eyebrow" id="ed-safe">Aviso de salud</h2>
        <div className="card flat">
          <SwitchRow title="Pedir aceptar un aviso antes de entrenar" checked={p.safety.requiresHealthNotice}
            onChange={v => up(q => { q.safety.requiresHealthNotice = v; if (v && !q.safety.warnings.length) q.safety.warnings = ['']; })}
            description="Recomendado si la rutina es para una lesión o una condición de salud." />
        </div>
        {p.safety.requiresHealthNotice && (
          <>
            <TextArea label="Texto del aviso (un párrafo por línea)" value={lines(p.safety.warnings)} rows={4} onChange={v => up(q => { q.safety.warnings = toLines(v); })}
              hint="Informa, no diagnostica. Por ejemplo: consulta con tu profesional sanitario antes de empezar." />
            <TextArea label="Texto de la casilla" value={p.safety.ackText || ''} onChange={v => up(q => { q.safety.ackText = v; })}
              placeholder="Ej.: He leído el aviso y entreno bajo mi responsabilidad." />
            {(hasIssue('safety')) && <p className="err"><Icon name="alert" />Completa el texto del aviso y el de la casilla.</p>}
          </>
        )}
        {!p.safety.requiresHealthNotice && (
          <TextArea label="Precauciones generales (una por línea, opcional)" value={lines(p.safety.warnings)} rows={2} onChange={v => up(q => { q.safety.warnings = toLines(v); })} />
        )}
      </section>

      <section aria-labelledby="ed-days" className="stack">
        <h2 className="sec eyebrow" id="ed-days">Días</h2>
        {p.days.map((d, i) => (
          <section key={i} className={`card card-pad stack ed-day${hasIssue(`days.${i}`) ? ' has-issue' : ''}`} data-day={d.color} aria-label={`Día ${i + 1}: ${d.name}`}>
            <div className="ed-day-hd">
              <DiscBadge day={d} size={40} />
              <span className="h3 grow">{d.name || `Día ${i + 1}`}</span>
              <button type="button" className="icon-btn" onClick={() => up(q => { q.days = move(q.days, i, -1); })} aria-label={`Subir ${d.name}`} aria-disabled={i === 0 || undefined}><Icon name="up" /></button>
              <button type="button" className="icon-btn" onClick={() => up(q => { q.days = move(q.days, i, 1); })} aria-label={`Bajar ${d.name}`} aria-disabled={i === p.days.length - 1 || undefined}><Icon name="down" /></button>
              <button type="button" className="icon-btn" onClick={() => (d.exercises.length ? setConfirmDay(i) : up(q => { q.days.splice(i, 1); }))} aria-label={`Eliminar ${d.name}`}><Icon name="trash" /></button>
            </div>
            {confirmDay === i && (
              <div className="confirm" role="group" aria-labelledby={`rmd-${i}`}>
                <p id={`rmd-${i}`}><b>¿Eliminar {d.name}?</b> Se quitan sus {d.exercises.length} ejercicios de la rutina.</p>
                <div className="btn-row">
                  <Button variant="secondary" onClick={() => setConfirmDay(null)} autoFocus>Cancelar</Button>
                  <Button variant="danger" onClick={() => { up(q => { q.days.splice(i, 1); }); setConfirmDay(null); }}>Eliminar</Button>
                </div>
              </div>
            )}
            <div className="two">
              <TextField label="Nombre del día" value={d.name} maxLength={30} onChange={e => { const v = e.target.value; up(q => { q.days[i].name = v; }); }} />
              <TextField label="Abreviatura" value={d.id} maxLength={3} narrow autoCapitalize="characters"
                error={issues.some(x => x.path === `days.${i}.id`) ? '1–3 letras o números, sin repetir.' : undefined}
                onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); up(q => { q.days[i].id = v; }); }} />
            </div>
            <TextField label="Enfoque" value={d.focus} maxLength={50} placeholder="Ej.: pierna y glúteo" onChange={e => { const v = e.target.value; up(q => { q.days[i].focus = v; }); }} />
            <div className="field">
              <span className="field-label" id={`col-${i}`}>Color</span>
              <div className="swatches" role="group" aria-labelledby={`col-${i}`}>
                {DAY_COLORS.map(c => (
                  <button key={c} type="button" data-day={c} aria-pressed={d.color === c} aria-label={COLOR_NAMES[c]} onClick={() => up(q => { q.days[i].color = c; })}>
                    {d.color === c && <Icon name="check" />}
                  </button>
                ))}
              </div>
            </div>

            <ul className="ed-exl" aria-label={`Ejercicios de ${d.name}`}>
              {d.exercises.map((e, j) => (
                <li key={e.key} className={hasIssue(`days.${i}.exercises.${j}`) ? 'has-issue' : ''}>
                  <ExerciseIllustration pose={e.pose} size="xs" imageSrc={e.gifUrl} />
                  <span className="tx"><b>{e.name}</b><span className="sm muted">{targetText(e)} · RIR {e.rir}</span></span>
                  <span className="acts">
                    <button type="button" className="icon-btn" onClick={() => up(q => { q.days[i].exercises = move(q.days[i].exercises, j, -1); })} aria-label={`Subir ${e.name}`} aria-disabled={j === 0 || undefined}><Icon name="up" /></button>
                    <button type="button" className="icon-btn" onClick={() => up(q => { q.days[i].exercises = move(q.days[i].exercises, j, 1); })} aria-label={`Bajar ${e.name}`} aria-disabled={j === d.exercises.length - 1 || undefined}><Icon name="down" /></button>
                    <button type="button" className="icon-btn" onClick={() => setEditEx({ day: i, index: j, ex: e })} aria-label={`Editar ${e.name}`}><Icon name="pencil" /></button>
                    <button type="button" className="icon-btn" onClick={() => up(q => { q.days[i].exercises.splice(j, 1); })} aria-label={`Quitar ${e.name}`}><Icon name="trash" /></button>
                  </span>
                </li>
              ))}
            </ul>
            {!d.exercises.length && <p className="sm muted">Sin ejercicios todavía.</p>}
            <Button variant="secondary" block icon="plus" onClick={() => setPicker(i)}>Añadir ejercicio</Button>
          </section>
        ))}
        {p.days.length < 7 && <Button variant="secondary" block icon="plus" onClick={() => up(q => { q.days.push(blankDay(q.days.length, q.days)); })}>Añadir día</Button>}
      </section>

      {p.days.length > 0 && (
        <section className="card card-pad stack" aria-labelledby="ed-week">
          <h2 className="eyebrow" id="ed-week">Semana tipo</h2>
          <p className="hint">Qué día de la semana toca cada entrenamiento. El resto, descanso o cardio suave.</p>
          <div className="week-ed">
            {WEEK_LETTERS.map(([l, name], idx) => (
              <label key={l} className="week-ed-row">
                <span>{name}</span>
                <select className="inp" value={plan[idx][1] || ''} onChange={e => { const v = e.target.value || null; up(q => { q.weekPlan = plan.map((x, k) => (k === idx ? [x[0], v] : x)); }); }}>
                  <option value="">Descanso</option>
                  {p.days.filter(d => d.id).map(d => <option key={d.id} value={d.id}>{d.id} · {d.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>
      )}

      <div className="stack-sm ed-save">
        <Button variant="primary" block onClick={save} loading={busy}>Guardar rutina</Button>
        <Button variant="secondary" block onClick={() => (dirty ? setLeaving(true) : onClose())}>Cancelar</Button>
      </div>

      {picker !== null && <ExercisePicker dayName={p.days[picker].name || `Día ${picker + 1}`} onClose={() => setPicker(null)} onPick={e => addExercise(picker, e)} />}
      {editEx && (
        <ExerciseEditor key={editEx.ex.key} initial={editEx.ex} onClose={() => setEditEx(null)}
          onSave={e => { up(q => { q.days[editEx.day].exercises[editEx.index] = e; }); setEditEx(null); }} />
      )}
    </main>
  );
}
