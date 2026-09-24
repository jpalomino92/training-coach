/* Peso corporal dentro de Progreso. La variación va siempre en color neutro:
   el peso no se presenta como éxito o fracaso. */
import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { WeightChart } from '../components/Charts';
import { FieldError, TextField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { WeightStepper } from '../components/WeightStepper';
import { DAY_MS, fmtDate, fmtDayMonth, fmtDayMonthShort, fmtNum, fmtWeekdayLong, fmtWeekdayShort, localDate, parseNum, toDate } from '../domain/format';
import type { BodyWeight } from '../domain/types';
import { weekNumber } from '../domain/workout';
import { useApp } from '../state/AppContext';

type Range = '4w' | '3m' | 'all';
const RANGES: { id: Range; label: string; days: number }[] = [
  { id: '4w', label: '4 semanas', days: 28 },
  { id: '3m', label: '3 meses', days: 91 },
  { id: 'all', label: 'Todo', days: Infinity }
];

const sortAsc = (a: BodyWeight, b: BodyWeight) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at);
const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v));
const days = (a: string, b: string) => Math.round((+toDate(b) - +toDate(a)) / DAY_MS);

function WeightSheet({ editing, last, onClose }: { editing: BodyWeight | null; last: BodyWeight | null; onClose(): void }) {
  const { addBodyWeight, updateBodyWeight, deleteBodyWeight, showToast } = useApp();
  const [weight, setWeight] = useState(editing ? fmtNum(editing.weight_kg) : last ? fmtNum(last.weight_kg) : '');
  const [date, setDate] = useState(editing?.date || localDate());
  const [note, setNote] = useState(editing?.note || '');
  const [err, setErr] = useState<{ weight?: string; date?: string }>({});
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const w = parseNum(weight);
    const errs: typeof err = {};
    if (w == null || Number.isNaN(w) || w <= 0 || w >= 500) errs.weight = 'Escribe tu peso en kg, por ejemplo 74,5.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDate()) errs.date = 'Elige una fecha de hoy o anterior.';
    setErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const rec = { weight_kg: Math.round(w! * 10) / 10, date, note: note.trim() };
      if (editing) await updateBodyWeight(editing.id, rec); else await addBodyWeight(rec);
      showToast(editing ? 'Registro actualizado.' : 'Peso registrado.');
      onClose();
    } catch (ex) {
      showToast(ex instanceof Error ? ex.message : 'No se pudo guardar.');
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    try { await deleteBodyWeight(editing.id); showToast('Registro eliminado.'); onClose(); }
    catch (ex) { showToast(ex instanceof Error ? ex.message : 'No se pudo eliminar.'); setBusy(false); }
  };

  return (
    <Sheet title={editing ? 'Editar peso' : 'Registrar peso'} onClose={onClose}>
      <form className="stack" onSubmit={save} noValidate>
        <div className="stack-sm">
          <WeightStepper big value={weight} step={0.1} onChange={setWeight} error={!!err.weight} errorId="bw-err" />
          <FieldError id="bw-err">{err.weight}</FieldError>
          {last && !editing && <p className="hint">Último: {fmtNum(last.weight_kg)} kg el {fmtDayMonth(last.date)}</p>}
        </div>
        <TextField label="Fecha" type="date" value={date} max={localDate()} onChange={e => setDate(e.target.value)} error={err.date}
          hint={date === localDate() ? `Hoy, ${fmtWeekdayLong(date)}` : undefined} />
        <TextField label={<>Nota <span className="label-opt">(opcional)</span></>} value={note} maxLength={500} placeholder="Por ejemplo: en ayunas" onChange={e => setNote(e.target.value)} />
        <Button variant="primary" block type="submit" loading={busy}>Guardar</Button>
        {editing && <Button variant="link" className="danger" icon="trash" onClick={remove} style={{ alignSelf: 'center' }}>Eliminar registro</Button>}
      </form>
    </Sheet>
  );
}

export function BodyWeightPanel() {
  const { data, profile } = useApp();
  const [range, setRange] = useState<Range>('3m');
  const [sheet, setSheet] = useState<{ editing: BodyWeight | null } | null>(null);
  const [all, setAll] = useState(false);
  const list = data.bodyWeights.slice().sort(sortAsc);
  const last = list[list.length - 1] || null;

  if (!last) {
    return (
      <>
        <div className="card empty">
          <h2 className="h3">Aún no has registrado tu peso</h2>
          <p className="muted">Con un registro por semana ya verás la tendencia. Tus datos solo los ves tú.</p>
          <Button variant="primary" icon="plus" onClick={() => setSheet({ editing: null })}>Registrar peso</Button>
        </div>
        {sheet && <WeightSheet editing={sheet.editing} last={null} onClose={() => setSheet(null)} />}
      </>
    );
  }

  const first = list[0];
  const change = last.weight_kg - first.weight_kg;
  const weekRef = [...list].reverse().find(b => days(b.date, last.date) >= 7);
  const span = days(first.date, last.date);
  const perWeek = span >= 7 ? change / (span / 7) : null;
  const weeksSpan = Math.max(1, Math.ceil((span + 1) / 7));

  const r = RANGES.find(x => x.id === range)!;
  const inRange = list.filter(b => days(b.date, last.date) < r.days);
  const pts = inRange.map(b => ({ x: +toDate(b.date), y: b.weight_kg, label: `${fmtDayMonth(b.date)} · ${fmtNum(b.weight_kg)} kg` }));
  const labelIdx = pts.length > 2 ? [0, Math.floor((pts.length - 1) / 2), pts.length - 1] : pts.map((_, i) => i);
  const xLabels = [...new Set(labelIdx)].map(i => ({ x: pts[i].x, label: fmtDayMonthShort(inRange[i].date) }));
  const start = profile?.start_date || first.date;
  const fr = inRange[0], lr = inRange[inRange.length - 1];
  const desc = [...list].reverse();

  return (
    <>
      <section className="card wt-hero" aria-labelledby="wt-last">
        <span className="eyebrow" id="wt-last">Último registro · {fmtWeekdayShort(last.date)}</span>
        <div className="row">
          <span className="big">{fmtNum(last.weight_kg)}<small>kg</small></span>
          {list.length > 1 && (
            <span className="delta">
              <Icon name={change < 0 ? 'down' : change > 0 ? 'up' : 'equal'} />
              {fmtNum(Math.abs(change))} kg desde el {fmtDayMonth(first.date)}
              <span className="sr-only">{change < 0 ? ' menos' : change > 0 ? ' más' : ' sin cambios'}</span>
            </span>
          )}
        </div>
        <Button variant="primary" block icon="plus" onClick={() => setSheet({ editing: null })}>Registrar peso</Button>
      </section>

      <div className="tiles three">
        <div className="card tile sm"><b>{weekRef ? signed(last.weight_kg - weekRef.weight_kg) : '—'}</b><span>kg esta semana</span></div>
        <div className="card tile sm"><b>{perWeek == null ? '—' : signed(Math.round(perWeek * 10) / 10)}</b><span>kg por semana de media</span></div>
        <div className="card tile sm"><b>{list.length}</b><span>{list.length === 1 ? 'registro' : 'registros'} en {weeksSpan} {weeksSpan === 1 ? 'semana' : 'semanas'}</span></div>
      </div>

      <section className="card chart" aria-labelledby="wt-evo">
        <div className="hd"><h2 className="h3" id="wt-evo">Evolución</h2><span className="xs muted">kg</span></div>
        <div className="seg cols-3" role="group" aria-label="Rango del gráfico">
          {RANGES.map(x => <button key={x.id} type="button" aria-pressed={range === x.id} onClick={() => setRange(x.id)}>{x.label}</button>)}
        </div>
        {pts.length >= 2 ? (
          <WeightChart points={pts} xLabels={xLabels} fmtY={fmtNum}
            summary={`Peso corporal: de ${fmtNum(fr.weight_kg)} kg el ${fmtDate(fr.date)} a ${fmtNum(lr.weight_kg)} kg el ${fmtDate(lr.date)}. La lista de registros tiene todos los valores.`} />
        ) : (
          <p className="need">Necesitas al menos 2 registros en este rango para ver la evolución.</p>
        )}
        <div className="evo">
          <span>Semana {weekNumber(fr.date, start)} → <b>{fmtNum(fr.weight_kg)} kg</b></span>
          <span>Semana {weekNumber(lr.date, start)} → <b>{fmtNum(lr.weight_kg)} kg</b></span>
        </div>
      </section>

      <div className="note"><Icon name="info" /><p>El peso cambia de un día a otro por el agua, la comida o el sueño. Fíjate en la tendencia de varias semanas y pésate en condiciones parecidas.</p></div>

      <section className="card card-pad" aria-labelledby="wt-list">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="eyebrow" id="wt-list">Registros</h2>
          {desc.length > 5 && <button type="button" className="btn btn-link" onClick={() => setAll(a => !a)}>{all ? 'Ver menos' : 'Ver todos'}</button>}
        </div>
        <ul className="wlist">
          {(all ? desc : desc.slice(0, 5)).map((b, i) => (
            <li key={b.id}>
              <span className="d">{i === 0 ? `${fmtWeekdayShort(b.date).split(' ')[0]} ${fmtDate(b.date)}` : fmtDate(b.date)}{b.note && <span className="n">{b.note}</span>}</span>
              <span className="v">
                <b>{fmtNum(b.weight_kg)} kg</b>
                <button type="button" className="btn btn-link" onClick={() => setSheet({ editing: b })} aria-label={`Editar el registro del ${fmtDate(b.date)}`}>Editar</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {sheet && <WeightSheet editing={sheet.editing} last={last} onClose={() => setSheet(null)} />}
    </>
  );
}
