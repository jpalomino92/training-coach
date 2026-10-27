/* Perfil inicial en 2 pasos (datos → rutina). También sirve para "Editar perfil".
   En el paso 2 se puede crear una rutina a medida con IA (se revisa en el editor).
   El aviso de salud es obligatorio en las rutinas con requiresHealthNotice. */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { DiscBadge } from '../components/DayDisc';
import { TextField } from '../components/Fields';
import { HealthNoticeFull } from '../components/HealthNotice';
import { Icon } from '../components/Icon';
import { localDate, parseNum } from '../domain/format';
import { GOAL_OPTIONS, goalsOf } from '../domain/routineGenerate';
import type { RoutineImport } from '../domain/routineImport';
import { programList, routinePrograms } from '../domain/routines';
import type { Profile, ProfileInput } from '../domain/types';
import { useApp } from '../state/AppContext';
import { ProgramEditor } from './coach/ProgramEditor';
import { GenerateRoutineForm } from './GenerateRoutine';

export const SEX_OPTIONS = ['Mujer', 'Hombre', 'Otro', 'Prefiero no decirlo'];
export const LEVEL_OPTIONS: { value: string; hint: string }[] = [
  { value: 'Empiezo', hint: 'Empiezo: es tu primera vez o retomas tras un tiempo sin entrenar.' },
  { value: 'Intermedio', hint: 'Intermedio: entrenas con regularidad desde hace 6 meses o más.' },
  { value: 'Avanzado', hint: 'Avanzado: entrenas con regularidad desde hace años y dominas la técnica.' }
];

function Seg({ label, options, value, onChange, cols }: { label: string; options: string[]; value: string; onChange(v: string): void; cols?: number }) {
  const id = useId();
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>{label}</span>
      <div className={`seg ${cols === 2 ? 'cols-2' : 'cols-3'}`}>
        {options.map(o => <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>{o}</button>)}
      </div>
    </div>
  );
}

export function OnboardingView() {
  const { profile, saveProfile, setEditingProfile, signOut, showToast, assignedProgram, usingAssigned, aiImporter, saveOwnProgram } = useApp();
  const editing = !!profile;
  /** 'ai': respuestas para la rutina a medida; 'review': la rutina creada, en el editor. */
  const [step, setStep] = useState<1 | 2 | 'ai' | 'review'>(1);
  const [generated, setGenerated] = useState<RoutineImport | null>(null);
  const [name, setName] = useState(profile?.name || '');
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '');
  const [sex, setSex] = useState(profile?.sex || '');
  const [goals, setGoals] = useState<string[]>(() => goalsOf(profile?.goal));
  const [level, setLevel] = useState(profile?.level || '');
  const [routineId, setRoutineId] = useState(profile?.routine_id || '');
  const [ack, setAck] = useState(!!(profile?.health_notice_ack_at));
  const [errors, setErrors] = useState<{ name?: string; age?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const ageRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const goalId = useId();

  useEffect(() => { if (step !== 'review') { titleRef.current?.focus(); window.scrollTo({ top: 0 }); } }, [step]);

  const selected = routineId ? routinePrograms[routineId] : null;
  const needsAck = !!selected?.safety.requiresHealthNotice;
  // El aviso se acepta para una rutina concreta: al cambiar de rutina hay que volver a aceptarlo
  const ackValid = ack;

  const next = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Escribe tu nombre.';
    const a = parseNum(age);
    if (age.trim() && (a == null || Number.isNaN(a) || a < 14 || a > 100)) errs.age = 'Escribe una edad entre 14 y 100 años.';
    setErrors(errs);
    if (errs.name) nameRef.current?.focus(); else if (errs.age) ageRef.current?.focus();
    if (!Object.keys(errs).length) setStep(2);
  };

  const reason = !selected ? 'Elige una rutina para continuar' : needsAck && !ackValid ? 'Marca la casilla del aviso para continuar' : null;

  const ageNum = () => { const a = parseNum(age); return a && !Number.isNaN(a) ? Math.round(a) : null; };

  const finish = (e: FormEvent) => {
    e.preventDefault();
    if (reason || busy) return;
    void save(routineId, needsAck);
  };

  /** Guarda el perfil con esa rutina (una incluida o la propia recién creada). */
  const save = async (id: string, withAck: boolean) => {
    setBusy(true);
    try {
      const prev: Partial<Profile> = profile || {};
      const input: ProfileInput = {
        name: name.trim(), age: ageNum(), sex, goal: goals.join(', '), level, routine_id: id,
        start_date: prev.start_date || localDate(),
        health_notice_ack_at: withAck
          ? (prev.routine_id === id && prev.health_notice_ack_at ? prev.health_notice_ack_at : new Date().toISOString())
          : prev.health_notice_ack_at || null,
        theme: prev.theme || 'auto',
        show_body_weight: prev.show_body_weight ?? true,
        // Elegir otra rutina deja de lado la del entrenador (se puede volver desde Rutina)
        ...(assignedProgram && usingAssigned && prev.routine_id !== id ? { prefs: { ...prev.prefs, own_routine_over: assignedProgram.id } } : {})
      };
      await saveProfile(input);
      if (editing) showToast('Perfil guardado.');
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'No se pudo guardar. Inténtalo de nuevo.' });
      setBusy(false);
      // La rutina creada con IA ya quedó en Mis rutinas: se vuelve a la elección de rutina con el error
      setStep(s => (s === 'review' ? 2 : s));
    }
  };

  if (step === 1) {
    return (
      <main className="auth wide">
        {editing && <button type="button" className="back" onClick={() => setEditingProfile(false)}><Icon name="chevL" />Volver al perfil</button>}
        <div className="stack-sm">
          <span className="eyebrow">Paso 1 de 2</span>
          <div className="steps" aria-hidden="true"><i className="on" /><i /></div>
        </div>
        <h1 className="h1" tabIndex={-1} ref={titleRef}>{editing ? 'Editar perfil' : 'Cuéntanos sobre ti'}</h1>
        <form onSubmit={next} noValidate aria-label="Tus datos">
          <TextField ref={nameRef} label="Nombre" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} error={errors.name} maxLength={80} />
          <TextField ref={ageRef} label="Edad" inputMode="numeric" narrow value={age} onChange={e => setAge(e.target.value)} error={errors.age} />
          <Seg label="Sexo" options={SEX_OPTIONS} value={sex} onChange={setSex} cols={2} />
          <div className="field" role="group" aria-labelledby={goalId}>
            <span className="field-label" id={goalId}>Objetivos <span className="label-opt">(puedes elegir varios)</span></span>
            <div className="opt-list">
              {GOAL_OPTIONS.map(g => (
                <button key={g} type="button" className="opt" aria-pressed={goals.includes(g)}
                  onClick={() => setGoals(list => (list.includes(g) ? list.filter(x => x !== g) : [...list, g]))}>
                  <span className="rd">{goals.includes(g) && <Icon name="check" />}</span>{g}
                </button>
              ))}
            </div>
          </div>
          <div className="stack-sm">
            <Seg label="Nivel" options={LEVEL_OPTIONS.map(l => l.value)} value={level} onChange={setLevel} />
            {level && <p className="hint">{LEVEL_OPTIONS.find(l => l.value === level)?.hint}</p>}
          </div>
          <Button variant="primary" block type="submit">Continuar</Button>
          {!editing && <button type="button" className="btn btn-link" style={{ alignSelf: 'center' }} onClick={() => signOut()}>Cerrar sesión</button>}
        </form>
      </main>
    );
  }

  if (step === 'review' && generated?.program) {
    return (
      <ProgramEditor initial={generated.program} isNew notes={generated.notes} review={generated.review} backLabel="Volver"
        onClose={() => setStep('ai')}
        onSave={p => saveOwnProgram(p)}
        onSaved={p => void save(p.id, false)} />
    );
  }

  if (step === 'ai') {
    return (
      <main className="auth wide">
        <button type="button" className="back" onClick={() => setStep(2)}><Icon name="chevL" />Elegir una rutina</button>
        <div className="stack-sm">
          <span className="eyebrow">Paso 2 de 2</span>
          <div className="steps" aria-hidden="true"><i className="on" /><i className="on" /></div>
        </div>
        <h1 className="h1" tabIndex={-1} ref={titleRef}>Tu rutina a medida</h1>
        <p className="muted">Cuéntale a la IA cómo puedes entrenar. Crea la rutina con los ejercicios de la app y después la revisas antes de guardarla.</p>
        <GenerateRoutineForm base={{ age: ageNum(), sex, goals, level }} onResult={r => { setGenerated(r); setStep('review'); }} />
        {errors.form && <div className="alert" role="alert"><Icon name="alert" /><p>{errors.form}</p></div>}
      </main>
    );
  }

  return (
    <main className="auth wide">
      <button type="button" className="back" onClick={() => setStep(1)}><Icon name="chevL" />Paso 1</button>
      <div className="stack-sm">
        <span className="eyebrow">Paso 2 de 2</span>
        <div className="steps" aria-hidden="true"><i className="on" /><i className="on" /></div>
      </div>
      <h1 className="h1" tabIndex={-1} ref={titleRef}>Elige tu rutina</h1>
      {editing && <p className="muted">Si cambias de rutina, tu historial anterior se conserva.</p>}
      {assignedProgram && usingAssigned && (
        <div className="note"><Icon name="info" /><p>Ahora entrenas con <b>{assignedProgram.shortName}</b>, la rutina que te asignó tu entrenador. Si eliges otra, dejarás de usarla; puedes volver a ella desde Rutina › Cambiar de rutina.</p></div>
      )}
      {aiImporter && (
        <button type="button" className="rcard ai-card" onClick={() => setStep('ai')}>
          <span className="top"><span className="h3">Crear una rutina a tu medida con IA</span><Icon name="chevR" /></span>
          <span className="sm">Con tus objetivos, los días y el tiempo que tienes, dónde entrenas y tus lesiones. La revisas antes de empezar.</span>
        </button>
      )}
      <form onSubmit={finish} noValidate aria-label="Elige tu rutina">
        <div className="stack-sm" role="group" aria-label="Rutinas">
          <span className="eyebrow">Rutinas</span>
          {programList().map(p => (
            <button key={p.id} type="button" className="rcard" aria-pressed={routineId === p.id}
              onClick={() => { setRoutineId(p.id); setAck(p.id === profile?.routine_id && !!profile?.health_notice_ack_at); }}>
              <span className="top">
                <span className="h3">{p.shortName}</span>
                <span className="rd" aria-hidden="true">{routineId === p.id && <Icon name="check" />}</span>
              </span>
              <span className="muted sm">{p.daysPerWeek} días · {p.audience} · {p.level}</span>
              <span className="sm">{p.description}</span>
              <span className="mini" aria-hidden="true">{p.days.map(d => <DiscBadge key={d.id} day={d} size={32} />)}</span>
            </button>
          ))}
        </div>

        {selected && needsAck && (
          <HealthNoticeFull safety={selected.safety}>
            <label className="check">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
              <span>{selected.safety.ackText}</span>
            </label>
          </HealthNoticeFull>
        )}

        {errors.form && <div className="alert" role="alert"><Icon name="alert" /><p>{errors.form}</p></div>}
        <Button variant="primary" block type="submit" loading={busy} disabledReason={reason} showReason>
          {editing ? 'Guardar cambios' : 'Empezar'}
        </Button>
        {editing && <Button variant="secondary" block onClick={() => setEditingProfile(false)}>Cancelar</Button>}
      </form>
    </main>
  );
}
