/* "Cambiar de rutina": la asignada por el entrenador, las propias y las incluidas.
   Desde aquí también se importa, se crea o se copia una rutina propia.
   El historial no se pierde: los ejercicios que se repiten siguen con sus pesos. */
import { useState } from 'react';
import { Button } from '../components/Button';
import { DiscBadge } from '../components/DayDisc';
import { HealthNoticeFull } from '../components/HealthNotice';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { asOwnProgram, blankProgram, duplicateProgram } from '../domain/customProgram';
import { programList } from '../domain/routines';
import type { Program } from '../domain/types';
import { useApp } from '../state/AppContext';

interface Props {
  onClose(): void;
  /** Abre el editor con una rutina propia (nueva o existente). */
  onEdit(p: Program, isNew: boolean): void;
  onImport(): void;
  /** Crear una rutina a medida con IA. */
  onGenerate(): void;
}

export function RoutinePicker({ onClose, onEdit, onImport, onGenerate }: Props) {
  const { program, profile, assignedProgram, ownPrograms, chooseRoutine, deleteOwnProgram, showToast, coachLink, aiImporter } = useApp();
  const [picked, setPicked] = useState(program.id);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const builtins = programList();
  const options: Program[] = [...(assignedProgram ? [assignedProgram] : []), ...ownPrograms, ...builtins];
  const selected = options.find(p => p.id === picked) || options.find(p => p.id === program.id) || builtins[0];
  const isAssigned = selected.id === assignedProgram?.id;
  // Las rutinas incluidas con aviso de salud lo piden al elegirlas (salvo que ya se aceptara para esa rutina);
  // la del entrenador y las propias lo piden en Hoy antes de entrenar
  const needsAck = !selected.custom && selected.safety.requiresHealthNotice && !(profile?.routine_id === selected.id && profile.health_notice_ack_at);
  const changed = selected.id !== program.id;
  const reason = !changed ? 'Elige una rutina distinta de la actual' : needsAck && !ack ? 'Marca la casilla del aviso para continuar' : null;

  const pick = (id: string) => { setPicked(id); setAck(false); setConfirmDelete(false); };

  const save = async () => {
    if (reason || busy) return;
    setBusy(true);
    try {
      await chooseRoutine(selected.id, ack);
      showToast(`Ahora entrenas con ${selected.shortName}.`);
      onClose();
    } catch (e) {
      setBusy(false);
      showToast(e instanceof Error ? e.message : 'No se pudo cambiar la rutina.');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteOwnProgram(selected.id);
      showToast(`"${selected.shortName}" eliminada. Tu historial se conserva.`);
      pick(program.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo eliminar la rutina.');
    } finally { setBusy(false); }
  };

  const card = (p: Program) => {
    const fromCoach = p.id === assignedProgram?.id;
    return (
      <button key={p.id} type="button" className="rcard" aria-pressed={selected.id === p.id} onClick={() => pick(p.id)}>
        <span className="top">
          <span className="h3">{p.shortName}</span>
          <span className="rd" aria-hidden="true">{selected.id === p.id && <Icon name="check" />}</span>
        </span>
        <span className="muted sm">
          {[fromCoach ? `De ${coachLink?.coachName || p.coachName || 'tu entrenador'}` : '', `${p.daysPerWeek} días`, p.audience, p.level, p.id === program.id ? 'Actual' : ''].filter(Boolean).join(' · ')}
        </span>
        {p.description && <span className="sm">{p.description}</span>}
        <span className="mini" aria-hidden="true">{p.days.map(d => <DiscBadge key={d.id} day={d} size={32} />)}</span>
      </button>
    );
  };

  return (
    <Sheet title="Cambiar de rutina" onClose={onClose}>
      <p className="hint">Tu historial se conserva. Si un ejercicio se repite en la nueva rutina, sigue con sus pesos, sus récords y su progreso.</p>
      {assignedProgram && (
        <div className="stack-sm" role="group" aria-label="De tu entrenador">{card(assignedProgram)}</div>
      )}
      {ownPrograms.length > 0 && (
        <>
          <h3 className="eyebrow picker-sec">Mis rutinas</h3>
          <div className="stack-sm" role="group" aria-label="Mis rutinas">{ownPrograms.map(card)}</div>
        </>
      )}
      <h3 className="eyebrow picker-sec">Incluidas</h3>
      <div className="stack-sm" role="group" aria-label="Rutinas incluidas">{builtins.map(card)}</div>

      {selected.own && !confirmDelete && (
        <div className="mine-acts">
          <Button variant="secondary" small icon="pencil" onClick={() => { onClose(); onEdit(selected, false); }}>Editar {selected.shortName}</Button>
          <Button variant="secondary" small icon="trash" onClick={() => setConfirmDelete(true)}
            disabledReason={selected.id === program.id ? 'Es la rutina que estás usando: elige otra antes de eliminarla' : null} showReason>Eliminar</Button>
        </div>
      )}
      {selected.own && confirmDelete && (
        <div className="confirm" role="group" aria-labelledby="rm-own">
          <p id="rm-own"><b>¿Eliminar {selected.shortName}?</b> Los entrenamientos que hiciste con ella siguen en tu historial.</p>
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} autoFocus>Cancelar</Button>
            <Button variant="danger" onClick={remove} loading={busy}>Eliminar</Button>
          </div>
        </div>
      )}

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
      <Button variant="primary" block onClick={save} loading={busy && !confirmDelete} disabledReason={reason} showReason>
        {changed ? `Cambiar a ${selected.shortName}` : 'Cambiar de rutina'}
      </Button>

      <h3 className="eyebrow picker-sec">Añadir una rutina propia</h3>
      <div className="stack-sm">
        {aiImporter && <Button variant="secondary" block icon="plus" onClick={() => { onClose(); onGenerate(); }}>Crear una a tu medida con IA</Button>}
        <Button variant="secondary" block icon="upload" onClick={() => { onClose(); onImport(); }}>Importar rutina (Excel, foto o PDF)</Button>
        <Button variant="secondary" block icon="copy" onClick={() => { onClose(); onEdit(asOwnProgram(duplicateProgram(selected)), true); }}>Copiar {selected.shortName} y editarla</Button>
        <Button variant="secondary" block icon="plus" onClick={() => { onClose(); onEdit(asOwnProgram(blankProgram()), true); }}>Crear desde cero</Button>
      </div>
    </Sheet>
  );
}
