/* Temporizador de descanso flotante. Visible en todas las pestañas: tocarlo vuelve a Hoy.
   aria-live="polite" solo anuncia el final. */
import { useTimer } from '../state/TimerContext';

export function RestTimer({ onOpen, isToday }: { onOpen(): void; isToday: boolean }) {
  const { timer, left, finished, addSeconds, stop } = useTimer();
  if (!timer) return <div className="sr-only" aria-live="polite" />;
  const m = Math.floor(left / 60), s = left % 60;
  const pct = timer.total ? Math.min(100, Math.max(0, 100 - (left / timer.total) * 100)) : 100;
  return (
    <>
      <div className="sr-only" aria-live="polite">{finished ? `Descanso terminado. ${timer.nextLabel}` : ''}</div>
      <section className={`timer${finished ? ' fin' : ''}`} aria-label="Temporizador de descanso">
        <div className="in">
          <button type="button" className="body" onClick={onOpen} disabled={isToday} aria-label={isToday ? undefined : 'Volver a Hoy'}>
            {finished ? (
              <>
                <span className="t">Descanso terminado</span>
                <span className="sub">{timer.nextLabel}</span>
              </>
            ) : (
              <>
                <span className="eyebrow">{timer.label}</span>
                <span className="t" role="timer" aria-label={`Quedan ${m} minutos y ${s} segundos`}>{m}:{String(s).padStart(2, '0')}</span>
              </>
            )}
          </button>
          {finished ? (
            <button type="button" className="tb solid" onClick={stop}>Cerrar</button>
          ) : (
            <>
              <button type="button" className="tb ghost" onClick={() => addSeconds(15)} aria-label="Añadir 15 segundos">+15 s</button>
              <button type="button" className="tb solid" onClick={stop}>Saltar</button>
            </>
          )}
        </div>
        {!finished && <div className="prog" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
      </section>
    </>
  );
}
