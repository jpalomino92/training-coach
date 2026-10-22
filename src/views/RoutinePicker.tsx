/* "Cambiar de rutina": las rutinas incluidas y la asignada por el entrenador.
   El historial no se pierde: los ejercicios que se repiten siguen con sus pesos. */
import { useState } from 'react';
import { Button } from '../components/Button';
import { DiscBadge } from '../components/DayDisc';
import { HealthNoticeFull } from '../components/HealthNotice';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { programList } from '../domain/routines';
import type { Program } from '../domain/types';
import { useApp } from '../state/AppContext';

export function RoutinePicker({ onClose }: { onClose(): void }) {
  const { program, profile, assignedProgram, chooseRoutine, showToast, coachLink } = useApp();
  const [picked, setPicked] = useState(program.id);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const options: Program[] = [...(assignedProgram ? [assignedProgram] : []), ...programList()];
  const selected = options.find(p => p.id === picked)!;
  const isAssigned = selected.id === assignedProgram?.id;
  // Las rutinas incluidas con aviso de salud lo piden al elegirlas (salvo que ya se aceptara para esa rutina);
  // la del entrenador lo pide en Hoy antes de entrenar
  const needsAck = !isAssigned && selected.safety.requiresHealthNotice && !(profile?.routine_id === selected.id && profile.health_notice_ack_at);
  const changed = picked !== program.id;
  const reason = !changed ? 'Elige una rutina distinta de la actual' : needsAck && !ack ? 'Marca la casilla del aviso para continuar' : null;

  const save = async () => {
    if (reason || busy) return;
    setBusy(true);
    try {
      await chooseRoutine(picked, ack);
      showToast(`Ahora entrenas con ${selected.shortName}.`);
      onClose();
    } catch (e) {
      setBusy(false);
      showToast(e instanceof Error ? e.message : 'No se pudo cambiar la rutina.');
    }
  };

  return (
    <Sheet title="Cambiar de rutina" onClose={onClose}>
      <p className="hint">Tu historial se conserva. Si un ejercicio se repite en la nueva rutina, sigue con sus pesos, sus récords y su progreso.</p>
      <div className="stack-sm" role="group" aria-label="Rutinas">
        {options.map(p => {
          const fromCoach = p.id === assignedProgram?.id;
          return (
            <button key={p.id} type="button" className="rcard" aria-pressed={picked === p.id} onClick={() => { setPicked(p.id); setAck(false); }}>
              <span className="top">
                <span className="h3">{p.shortName}</span>
                <span className="rd" aria-hidden="true">{picked === p.id && <Icon name="check" />}</span>
              </span>
              <span className="muted sm">
                {[fromCoach ? `De ${coachLink?.coachName || p.coachName || 'tu entrenador'}` : '', `${p.daysPerWeek} días`, p.audience, p.level, p.id === program.id ? 'Actual' : ''].filter(Boolean).join(' · ')}
              </span>
              {p.description && <span className="sm">{p.description}</span>}
              <span className="mini" aria-hidden="true">{p.days.map(d => <DiscBadge key={d.id} day={d} size={32} />)}</span>
            </button>
          );
        })}
      </div>
      {needsAck && (
        <HealthNoticeFull safety={selected.safety}>
          <label className="check">
            <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
            <span>{selected.safety.ackText}</span>
          </label>
        </HealthNoticeFull>
      )}
      {assignedProgram && changed && !isAssigned && (
        <p className="hint">Dejarás de usar la rutina de tu entrenador. Puedes volver a ella cuando quieras desde aquí.</p>
      )}
      <Button variant="primary" block onClick={save} loading={busy} disabledReason={reason} showReason>
        {changed ? `Cambiar a ${selected.shortName}` : 'Cambiar de rutina'}
      </Button>
    </Sheet>
  );
}
