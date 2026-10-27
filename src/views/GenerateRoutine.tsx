/* Crear una rutina a medida con IA: objetivos (varios), días, minutos,
   lugar, lesiones y preferencias. Se usa en el perfil inicial y desde
   "Cambiar de rutina". Comparte el límite mensual con la lectura de fotos. */
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { loadLibrary } from '../domain/exerciseLibrary';
import { DAYS_OPTIONS, generatedRoutine, generateRequest, GOAL_OPTIONS, MINUTES_OPTIONS, PLACE_OPTIONS, type GenerateAnswers } from '../domain/routineGenerate';
import type { RoutineImport } from '../domain/routineImport';
import { AI_IMPORT_LIMIT } from '../services/aiImport';
import { useApp } from '../state/AppContext';
import { TextArea } from './coach/ExerciseEditor';

type Base = Pick<GenerateAnswers, 'age' | 'sex' | 'goals' | 'level'>;

export function GenerateRoutineForm({ base, onResult }: { base: Base; onResult(r: RoutineImport): void }) {
  const { aiImporter } = useApp();
  const [goals, setGoals] = useState<string[]>(base.goals);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [place, setPlace] = useState(PLACE_OPTIONS[0]);
  const [limitations, setLimitations] = useState('');
  const [preferences, setPreferences] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = { goals: useId(), days: useId(), minutes: useId(), place: useId() };

  useEffect(() => {
    let live = true;
    aiImporter?.remaining().then(n => { if (live) setRemaining(n); });
    return () => { live = false; };
  }, [aiImporter]);

  const toggleGoal = (g: string) => setGoals(list => (list.includes(g) ? list.filter(x => x !== g) : [...list, g]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiImporter || busy || remaining === 0) return;
    setBusy(true); setError('');
    const answers: GenerateAnswers = { ...base, goals, days, minutes, place, limitations: limitations.slice(0, 1000), preferences: preferences.slice(0, 1000) };
    try {
      const library = await loadLibrary();
      const out = await aiImporter.generate(generateRequest(answers, library));
      setRemaining(out.remaining);
      const res = generatedRoutine(out.routine, answers, library);
      if (!res.program) { setError('La IA no devolvió una rutina que se pueda usar. Inténtalo de nuevo.'); return; }
      onResult(res);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo crear la rutina.');
      aiImporter.remaining().then(setRemaining);
    } finally { setBusy(false); }
  };

  if (!aiImporter) {
    return <p className="note"><Icon name="info" />Crear una rutina con IA necesita una cuenta en la nube (no está disponible en modo demo).</p>;
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Rutina a tu medida" className="stack">
      <div className="field" role="group" aria-labelledby={ids.goals}>
        <span className="field-label" id={ids.goals}>Objetivos <span className="label-opt">(puedes elegir varios)</span></span>
        <div className="opt-list">
          {GOAL_OPTIONS.map(g => (
            <button key={g} type="button" className="opt" aria-pressed={goals.includes(g)} onClick={() => toggleGoal(g)}>
              <span className="rd">{goals.includes(g) && <Icon name="check" />}</span>{g}
            </button>
          ))}
        </div>
      </div>
      <div className="field" role="group" aria-labelledby={ids.days}>
        <span className="field-label" id={ids.days}>Días por semana</span>
        <div className="seg cols-5">
          {DAYS_OPTIONS.map(n => <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)}>{n}</button>)}
        </div>
      </div>
      <div className="field" role="group" aria-labelledby={ids.minutes}>
        <span className="field-label" id={ids.minutes}>Minutos por sesión</span>
        <div className="seg cols-5">
          {MINUTES_OPTIONS.map(n => <button key={n} type="button" aria-pressed={minutes === n} onClick={() => setMinutes(n)}>{n}</button>)}
        </div>
      </div>
      <div className="field" role="group" aria-labelledby={ids.place}>
        <span className="field-label" id={ids.place}>Dónde entrenas</span>
        <div className="seg cols-2">
          {PLACE_OPTIONS.map(o => <button key={o} type="button" aria-pressed={place === o} onClick={() => setPlace(o)}>{o}</button>)}
        </div>
      </div>
      <TextArea label="Lesiones o limitaciones (opcional)" value={limitations} rows={3} onChange={v => setLimitations(v.slice(0, 1000))}
        placeholder="Ej.: hernia lumbar, rodilla derecha operada, artrosis en las manos."
        hint="La IA evita los ejercicios que las comprometan. Si escribes alguna, tendrás que aceptar las precauciones antes de entrenar." />
      <TextArea label="Algo más (opcional)" value={preferences} rows={2} onChange={v => setPreferences(v.slice(0, 1000))}
        placeholder="Ej.: me gustan las máquinas, no tengo barra, quiero más glúteo." />

      <p className="sm">
        <b>{remaining == null ? `Hasta ${AI_IMPORT_LIMIT} usos de IA por mes.` : `Te quedan ${remaining} de ${AI_IMPORT_LIMIT} usos de IA este mes.`}</b>{' '}
        Se comparten con la lectura de fotos y PDF. Si falla, no cuenta. Después la revisas y la puedes cambiar.
      </p>
      {error && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}
      {busy && <p className="hint" role="status">Creando tu rutina… puede tardar hasta un minuto.</p>}
      <Button variant="primary" block type="submit" loading={busy}
        disabledReason={remaining === 0 ? 'Ya usaste los usos de IA de este mes' : null} showReason>
        Crear mi rutina con IA
      </Button>
    </form>
  );
}
