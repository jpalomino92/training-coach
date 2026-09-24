/* Añadir un ejercicio: búsqueda en ExerciseDB (en inglés, con GIF) o
   desde los ejercicios de las rutinas incluidas. */
import { useEffect, useId, useMemo, useState } from 'react';
import { ExerciseIllustration } from '../../components/ExerciseIllustration';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { equipmentEs, exerciseFromDb, muscleEs, type ExerciseDbItem } from '../../domain/customProgram';
import { targetText } from '../../domain/format';
import { programList } from '../../domain/routines';
import type { Exercise } from '../../domain/types';
import { searchExercises } from '../../services/exercisedb';

type Source = 'edb' | 'builtin';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Ejercicios de las rutinas incluidas, sin repetir. */
function builtinCatalog(): Exercise[] {
  const seen = new Map<string, Exercise>();
  for (const p of programList()) for (const d of p.days) for (const e of d.exercises) if (!seen.has(e.key)) seen.set(e.key, e);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function ExercisePicker({ dayName, onPick, onClose }: { dayName: string; onPick(e: Exercise): void; onClose(): void }) {
  const [source, setSource] = useState<Source>('edb');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ExerciseDbItem[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const inputId = useId();
  const catalog = useMemo(builtinCatalog, []);

  useEffect(() => {
    if (source !== 'edb') return;
    const term = q.trim();
    if (term.length < 2) { setItems([]); setTotal(0); setState('idle'); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setState('loading');
      searchExercises(term, ctrl.signal)
        .then(r => { setItems(r.items); setTotal(r.total); setState('idle'); })
        .catch(e => { if ((e as Error).name !== 'AbortError') { setError((e as Error).message); setState('error'); } });
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, source]);

  const local = source === 'builtin'
    ? catalog.filter(e => !q.trim() || norm(`${e.name} ${e.muscle}`).includes(norm(q.trim())))
    : [];

  return (
    <Sheet title={`Añadir a ${dayName}`} onClose={onClose}>
      <div className="seg cols-2" role="group" aria-label="De dónde">
        <button type="button" aria-pressed={source === 'edb'} onClick={() => setSource('edb')}>ExerciseDB</button>
        <button type="button" aria-pressed={source === 'builtin'} onClick={() => setSource('builtin')}>De las rutinas</button>
      </div>
      <div className="field">
        <label htmlFor={inputId}>{source === 'edb' ? 'Buscar (en inglés)' : 'Buscar'}</label>
        <div className="search-inp">
          <Icon name="search" />
          <input id={inputId} className="inp" type="search" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" data-autofocus
            placeholder={source === 'edb' ? 'Ej.: squat, glute bridge, row' : 'Ej.: sentadilla, remo'} aria-describedby={`${inputId}-h`} />
        </div>
        <p className="hint" id={`${inputId}-h`}>
          {source === 'edb' ? 'Más de 1.300 ejercicios con animación. Los nombres vienen en inglés: puedes traducirlos después.' : 'Los mismos ejercicios de las rutinas incluidas, con su técnica y precauciones.'}
        </p>
      </div>

      <div aria-live="polite" className="sr-only">
        {source === 'edb' && state === 'idle' && q.trim().length >= 2 && `${items.length} resultados`}
      </div>

      {source === 'edb' && (
        <>
          {state === 'loading' && <p className="muted" aria-busy="true">Buscando…</p>}
          {state === 'error' && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}
          {state === 'idle' && q.trim().length >= 2 && !items.length && <p className="sm muted">Sin resultados. Prueba con otra palabra en inglés (por ejemplo "press" o "curl").</p>}
          <ul className="pick-list" aria-label="Resultados de ExerciseDB">
            {items.map(e => (
              <li key={e.exerciseId}>
                <button type="button" className="xrow" onClick={() => onPick(exerciseFromDb(e))} aria-label={`Añadir ${e.name}`}>
                  <ExerciseIllustration pose="plank" size="sm" imageSrc={e.gifUrl} />
                  <span className="tx">
                    <span className="t cap">{e.name}</span>
                    <span className="s">{[e.targetMuscles.map(muscleEs).join(', '), e.equipments.map(equipmentEs).join(', ')].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Icon name="plus" className="chev" />
                </button>
              </li>
            ))}
          </ul>
          {total > items.length && state === 'idle' && <p className="hint tc">Mostrando {items.length} de {total}. Afina la búsqueda para ver otros.</p>}
        </>
      )}

      {source === 'builtin' && (
        <ul className="pick-list" aria-label="Ejercicios de las rutinas">
          {local.map(e => (
            <li key={e.key}>
              <button type="button" className="xrow" onClick={() => onPick(structuredClone(e))} aria-label={`Añadir ${e.name}`}>
                <ExerciseIllustration pose={e.pose} size="sm" />
                <span className="tx">
                  <span className="t">{e.name}</span>
                  <span className="s">{e.muscle} · {targetText(e)}</span>
                </span>
                <Icon name="plus" className="chev" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
