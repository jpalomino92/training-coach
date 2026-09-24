/* ==========================================================
   PANEL DE ENTRENADOR (Perfil → Panel de entrenador).
   Alumnos (progreso en solo lectura y rutina asignada), rutinas propias
   e invitaciones. Solo aparece si tu cuenta está en la tabla coaches.
   ========================================================== */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { DiscBadge } from '../../components/DayDisc';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { duplicateProgram, blankProgram } from '../../domain/customProgram';
import { fmtDate } from '../../domain/format';
import { programList } from '../../domain/routines';
import type { Program } from '../../domain/types';
import type { AthleteRow, Invite } from '../../services/coach';
import { inviteUrl } from '../../services/inviteLink';
import { useApp } from '../../state/AppContext';
import { AthleteDetail } from './AthleteDetail';
import { ProgramEditor } from './ProgramEditor';

type Section = 'alumnos' | 'rutinas' | 'invitar';
const SECTIONS: { value: Section; label: string }[] = [
  { value: 'alumnos', label: 'Alumnos' },
  { value: 'rutinas', label: 'Rutinas' },
  { value: 'invitar', label: 'Invitar' }
];

const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function CoachPanel({ onClose }: { onClose(): void }) {
  const { coachApi, coach, showToast } = useApp();
  const [section, setSection] = useState<Section>('alumnos');
  const [athletes, setAthletes] = useState<AthleteRow[] | null>(null);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [athlete, setAthlete] = useState<AthleteRow | null>(null);
  const [editing, setEditing] = useState<Program | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    if (!coachApi) return;
    setLoadError('');
    try {
      const [a, p, i] = await Promise.all([coachApi.listAthletes(), coachApi.listPrograms(), coachApi.listInvites()]);
      setAthletes(a); setPrograms(p); setInvites(i);
    } catch (e) {
      setLoadError(errMsg(e, 'No se pudo cargar el panel.') + ' Comprueba la conexión.');
    }
  }, [coachApi]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { window.scrollTo({ top: 0 }); if (!athlete && !editing) titleRef.current?.focus(); }, [athlete, editing]);

  if (!coachApi || !coach) return null;

  if (editing) {
    return (
      <ProgramEditor initial={editing} isNew={!programs?.some(p => p.id === editing.id)}
        onClose={() => setEditing(null)}
        onSaved={p => { setPrograms(list => [p, ...(list || []).filter(x => x.id !== p.id)]); setEditing(null); }} />
    );
  }
  if (athlete) {
    return (
      <AthleteDetail athlete={athlete} programs={programs || []} onClose={() => setAthlete(null)}
        onChanged={a => setAthletes(list => (list || []).map(x => (x.id === a.id ? a : x)))}
        onRemoved={id => { setAthletes(list => (list || []).filter(x => x.id !== id)); setAthlete(null); }} />
    );
  }

  return (
    <main className="screen coach">
      <button type="button" className="back" onClick={onClose}><Icon name="chevL" />Volver al perfil</button>
      <div className="stack-sm">
        <span className="eyebrow">Panel de entrenador</span>
        <h1 className="h1" tabIndex={-1} ref={titleRef}>{coach.displayName}</h1>
      </div>

      <div className="seg cols-3" role="group" aria-label="Secciones del panel">
        {SECTIONS.map(s => <button key={s.value} type="button" aria-pressed={section === s.value} onClick={() => setSection(s.value)}>{s.label}</button>)}
      </div>

      {loadError && (
        <div className="alert" role="alert"><Icon name="alert" /><p>{loadError} <button type="button" className="btn btn-link" onClick={() => void load()}>Reintentar</button></p></div>
      )}

      {section === 'alumnos' && <AthleteList athletes={athletes} programs={programs || []} onOpen={setAthlete} onInvite={() => setSection('invitar')} />}
      {section === 'rutinas' && (
        <ProgramList programs={programs} coachName={coach.displayName} onEdit={setEditing}
          onDeleted={id => { setPrograms(list => (list || []).filter(p => p.id !== id)); setAthletes(list => (list || []).map(a => (a.programId === id ? { ...a, programId: null } : a))); }}
          assignedCount={id => (athletes || []).filter(a => a.programId === id).length}
          onError={m => showToast(m)} />
      )}
      {section === 'invitar' && <Invites invites={invites} setInvites={setInvites} />}
    </main>
  );
}

/* ---------- Alumnos ---------- */

function AthleteList({ athletes, programs, onOpen, onInvite }: { athletes: AthleteRow[] | null; programs: Program[]; onOpen(a: AthleteRow): void; onInvite(): void }) {
  if (!athletes) return <p className="muted" aria-busy="true">Cargando alumnos…</p>;
  if (!athletes.length) {
    return (
      <div className="empty card card-pad">
        <p><b>Todavía no tienes alumnos.</b></p>
        <p className="sm">Crea un código de invitación y compártelo. Cuando tu alumno lo use, aparecerá aquí.</p>
        <Button variant="primary" block icon="plus" onClick={onInvite}>Crear invitación</Button>
      </div>
    );
  }
  return (
    <ul className="alist" aria-label="Alumnos">
      {athletes.map(a => {
        const p = programs.find(x => x.id === a.programId);
        return (
          <li key={a.id}>
            <button type="button" className="xrow" onClick={() => onOpen(a)}>
              <span className="avatar sm" aria-hidden="true">{a.name.trim().charAt(0).toUpperCase() || '?'}</span>
              <span className="tx">
                <span className="t">{a.name}</span>
                <span className="s">{p ? `Rutina: ${p.shortName}` : 'Sin rutina asignada'} · desde el {fmtDate(a.since)}</span>
              </span>
              <Icon name="chevR" className="chev" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Rutinas ---------- */

function ProgramList({ programs, coachName, onEdit, onDeleted, assignedCount, onError }: {
  programs: Program[] | null; coachName: string; onEdit(p: Program): void; onDeleted(id: string): void;
  assignedCount(id: string): number; onError(msg: string): void;
}) {
  const { coachApi, showToast } = useApp();
  const [pick, setPick] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async (p: Program) => {
    setBusy(true);
    try {
      await coachApi!.deleteProgram(p.id);
      onDeleted(p.id);
      setConfirm(null);
      showToast(`"${p.shortName}" eliminada.`);
    } catch (e) { onError(errMsg(e, 'No se pudo eliminar la rutina.')); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="btn-row">
        <Button variant="primary" icon="plus" onClick={() => onEdit(blankProgram(coachName))}>Nueva rutina</Button>
        <Button variant="secondary" icon="copy" onClick={() => setPick(true)}>Partir de otra</Button>
      </div>
      {!programs ? <p className="muted" aria-busy="true">Cargando rutinas…</p> : !programs.length ? (
        <p className="sm muted">Aún no tienes rutinas propias. Crea una desde cero o parte de una de las incluidas: la original no cambia.</p>
      ) : (
        <ul className="plist" aria-label="Tus rutinas">
          {programs.map(p => {
            const n = assignedCount(p.id);
            return (
              <li key={p.id} className="card pcard">
                <div className="top">
                  <span className="h3">{p.shortName}</span>
                  <span className="mini" aria-hidden="true">{p.days.map(d => <DiscBadge key={d.id} day={d} size={28} />)}</span>
                </div>
                <span className="sm muted">
                  {p.days.length} {p.days.length === 1 ? 'día' : 'días'} · {p.days.reduce((s, d) => s + d.exercises.length, 0)} ejercicios
                  {p.safety.requiresHealthNotice && ' · con aviso de salud'}
                  {n > 0 && ` · asignada a ${n} ${n === 1 ? 'alumno' : 'alumnos'}`}
                </span>
                {confirm === p.id ? (
                  <div className="confirm" role="group" aria-label={`Eliminar ${p.shortName}`}>
                    <p><b>¿Eliminar "{p.shortName}"?</b> {n > 0 ? 'Se quitará a los alumnos que la tienen asignada (vuelven a su rutina).' : ''} Los entrenamientos ya registrados se conservan.</p>
                    <div className="btn-row">
                      <Button variant="secondary" onClick={() => setConfirm(null)} autoFocus>Cancelar</Button>
                      <Button variant="danger" onClick={() => remove(p)} loading={busy}>Eliminar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="btn-row">
                    <Button variant="secondary" small icon="pencil" onClick={() => onEdit(structuredClone(p))} aria-label={`Editar ${p.shortName}`}>Editar</Button>
                    <Button variant="secondary" small icon="copy" onClick={() => onEdit(duplicateProgram(p, coachName))} aria-label={`Duplicar ${p.shortName}`}>Duplicar</Button>
                    <Button variant="secondary" small icon="trash" onClick={() => setConfirm(p.id)} aria-label={`Eliminar ${p.shortName}`}>Eliminar</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {pick && (
        <Sheet title="Partir de una rutina" onClose={() => setPick(false)}>
          <p className="sm">Se crea una copia que puedes editar. La rutina original no cambia.</p>
          <div className="stack-sm" role="group" aria-label="Rutinas para copiar">
            {[...programList(), ...(programs || [])].map(p => (
              <button key={p.id} type="button" className="rcard" onClick={() => { setPick(false); onEdit(duplicateProgram(p, coachName)); }}>
                <span className="h3">{p.shortName}</span>
                <span className="muted sm">{p.custom ? 'Tuya' : 'Incluida'} · {p.days.length} días{p.level ? ` · ${p.level}` : ''}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Invitaciones ---------- */

function inviteState(i: Invite): string {
  if (i.usedAt) return `Usada el ${fmtDate(i.usedAt)}`;
  if (+new Date(i.expiresAt) < Date.now()) return 'Caducada';
  return `Válida hasta el ${fmtDate(i.expiresAt)}`;
}

function Invites({ invites, setInvites }: { invites: Invite[] | null; setInvites(f: (l: Invite[] | null) => Invite[] | null): void }) {
  const { coachApi, coach, showToast } = useApp();
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Invite | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      const inv = await coachApi!.createInvite(coach!.displayName);
      setInvites(l => [inv, ...(l || [])]);
      setFresh(inv);
    } catch (e) { showToast(errMsg(e, 'No se pudo crear la invitación.')); }
    finally { setBusy(false); }
  };

  const share = async (code: string) => {
    const url = inviteUrl(code);
    const text = `Únete a mis entrenamientos en la app. Tu código es ${code}: ${url}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Invitación', text, url }); return; }
      await navigator.clipboard.writeText(text);
      showToast('Invitación copiada. Pégala en un mensaje.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') showToast(`No se pudo copiar. El código es ${code}.`);
    }
  };

  const remove = async (code: string) => {
    try {
      await coachApi!.deleteInvite(code);
      setInvites(l => (l || []).filter(i => i.code !== code));
      if (fresh?.code === code) setFresh(null);
    } catch (e) { showToast(errMsg(e, 'No se pudo borrar la invitación.')); }
  };

  const pending = (invites || []).filter(i => !i.usedAt && +new Date(i.expiresAt) >= Date.now());
  const past = (invites || []).filter(i => !pending.includes(i));

  return (
    <>
      <section className="card card-pad" aria-labelledby="inv-t">
        <h2 className="eyebrow" id="inv-t">Nueva invitación</h2>
        <p className="sm">Cada código sirve para una persona y caduca a los 14 días. Al usarlo, tu alumno acepta compartir contigo su progreso (las notas de cada ejercicio no).</p>
        {fresh && (
          <div className="invite-new" role="status">
            <span className="sm muted">Código</span>
            <b className="invite-code" aria-label={`Código ${fresh.code.split('').join(' ')}`}>{fresh.code}</b>
            <Button variant="primary" block icon="link" onClick={() => share(fresh.code)}>Compartir invitación</Button>
          </div>
        )}
        <Button variant={fresh ? 'secondary' : 'primary'} block icon="plus" onClick={create} loading={busy}>Crear código</Button>
      </section>

      {invites && pending.length > 0 && (
        <section aria-labelledby="inv-p">
          <h2 className="sec eyebrow" id="inv-p">Pendientes</h2>
          <ul className="ilist">
            {pending.map(i => (
              <li key={i.code} className="card irow">
                <span className="tx"><b className="tnum">{i.code}</b><span className="sm muted">{inviteState(i)}</span></span>
                <Button variant="secondary" small icon="link" onClick={() => share(i.code)} aria-label={`Compartir ${i.code}`}>Compartir</Button>
                <Button variant="link" small onClick={() => remove(i.code)} aria-label={`Borrar ${i.code}`}><Icon name="trash" /></Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {invites && past.length > 0 && (
        <section aria-labelledby="inv-u">
          <h2 className="sec eyebrow" id="inv-u">Usadas o caducadas</h2>
          <ul className="ilist">
            {past.map(i => (
              <li key={i.code} className="card irow">
                <span className="tx"><b className="tnum">{i.code}</b><span className="sm muted">{inviteState(i)}</span></span>
                <Button variant="link" small onClick={() => remove(i.code)} aria-label={`Borrar ${i.code}`}><Icon name="trash" /></Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
