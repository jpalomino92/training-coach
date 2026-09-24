/* PERFIL → Entrenador (lado del alumno): unirse con un código, ver quién te entrena
   y dejar de compartir. Y, si eres entrenador, la entrada a tu panel. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { TextField } from '../components/Fields';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { fmtDate } from '../domain/format';
import { clearInvite, pendingInvite } from '../services/inviteLink';
import { useApp } from '../state/AppContext';

export const CONSENT_TEXT = 'Acepto que mi entrenador vea mis entrenamientos (con la nota del día), series, sensaciones, dolor marcado y peso corporal. Las notas de cada ejercicio no se comparten y puedo dejar de compartir cuando quiera.';

function JoinSheet({ initial, onClose }: { initial: string; onClose(): void }) {
  const { joinCoach, showToast } = useApp();
  const [code, setCode] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const reason = clean.length !== 8 ? 'Escribe el código de 8 letras o números' : !consent ? 'Marca la casilla para continuar' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason) return;
    setBusy(true); setError('');
    try {
      await joinCoach(clean);
      clearInvite();
      showToast('Te has unido. Tu entrenador ya puede ver tu progreso.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo usar el código.');
      setBusy(false);
    }
  };

  return (
    <Sheet title="Unirte a un entrenador" onClose={() => { clearInvite(); onClose(); }}>
      <form className="stack" onSubmit={submit} noValidate aria-label="Unirte a un entrenador">
        <TextField label="Código de invitación" value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters"
          maxLength={12} placeholder="Ej.: K7M2Q9XA" hint="Te lo da tu entrenador. Caduca a los 14 días." data-autofocus={!initial || undefined} className="code-inp" />
        <label className="check">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} data-autofocus={initial ? true : undefined} />
          <span>{CONSENT_TEXT}</span>
        </label>
        <p className="hint">Si tu entrenador te asigna una rutina, la verás en Hoy y en Rutina en lugar de la que elegiste. Tu historial se conserva.</p>
        {error && <div className="alert" role="alert"><Icon name="alert" /><p>{error}</p></div>}
        <Button variant="primary" block type="submit" loading={busy} disabledReason={reason} showReason>Unirme</Button>
      </form>
    </Sheet>
  );
}

export function CoachSection({ onOpenPanel }: { onOpenPanel(): void }) {
  const { coachApi, coach, coachLink, assignedProgram, leaveCoach, showToast } = useApp();
  const [join, setJoin] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Enlace de invitación abierto antes de entrar: se abre la hoja con el código
  useEffect(() => {
    const code = pendingInvite();
    if (!code) return;
    if (!coachApi) { clearInvite(); showToast('Las invitaciones necesitan una cuenta en la nube (no funcionan en modo demo).'); return; }
    if (!coachLink) setJoin(code);
    else clearInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (confirm) cancelRef.current?.focus(); }, [confirm]);

  if (!coachApi) return null;

  const leave = async () => {
    setBusy(true);
    try {
      await leaveCoach();
      setConfirm(false);
      showToast('Has dejado de compartir. Vuelves a tu rutina.');
    } catch (e) { showToast(e instanceof Error ? e.message : 'No se pudo dejar de compartir.'); }
    finally { setBusy(false); }
  };

  return (
    <section className="card card-pad" aria-labelledby="p-coach">
      <h2 className="eyebrow" id="p-coach">Entrenador</h2>
      {coachLink ? (
        <>
          <p className="coach-who"><Icon name="users" /><span><b>{coachLink.coachName}</b> ve tu progreso desde el {fmtDate(coachLink.since)}.</span></p>
          <p className="sm">{assignedProgram ? <>Te ha asignado <b>{assignedProgram.shortName}</b>.</> : 'Todavía no te ha asignado una rutina: sigues con la tuya.'}</p>
          {!confirm ? (
            <Button variant="secondary" block onClick={() => setConfirm(true)}>Dejar de compartir</Button>
          ) : (
            <div className="confirm" role="group" aria-labelledby="leave-q">
              <p id="leave-q"><b>¿Dejar de compartir con {coachLink.coachName}?</b> Dejará de ver tu progreso y volverás a tu rutina. Tu historial se conserva.</p>
              <div className="btn-row">
                <Button ref={cancelRef} variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
                <Button variant="danger" onClick={leave} loading={busy}>Dejar de compartir</Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="sm">¿Te entrena alguien? Con su código de invitación podrá asignarte rutinas y ver tu progreso.</p>
          <Button variant="secondary" block icon="users" onClick={() => setJoin('')}>Unirme con un código</Button>
        </>
      )}
      {coach && <Button variant="primary" block icon="users" onClick={onOpenPanel}>Panel de entrenador</Button>}
      {join !== null && <JoinSheet initial={join} onClose={() => setJoin(null)} />}
    </section>
  );
}
