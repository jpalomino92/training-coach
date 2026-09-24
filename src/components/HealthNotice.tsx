/* Aviso de salud. Solo en rutinas con safety.requiresHealthNotice.
   Es informativo (azul), no una alarma. Los textos salen literalmente de routines. */
import { useState, type ReactNode } from 'react';
import type { Safety } from '../domain/types';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

export function HealthNoticeBody({ safety }: { safety: Safety }) {
  return (
    <>
      {safety.warnings.map(w => <p key={w}>{w}</p>)}
      {!!safety.rules?.length && <ul>{safety.rules.map(r => <li key={r}>{r}</li>)}</ul>}
    </>
  );
}

/** Compacto (Hoy): una frase y "Leer aviso completo" en una hoja inferior. */
export function HealthNoticeCompact({ safety }: { safety: Safety }) {
  const [open, setOpen] = useState(false);
  if (!safety.requiresHealthNotice) return null;
  const sentence = safety.warnings[safety.warnings.length - 1];
  return (
    <aside className="health" aria-label="Aviso de salud">
      <Icon name="info" />
      <div className="tx">
        <b>Aviso de salud</b>
        <p>{sentence}</p>
        <button type="button" className="btn btn-link" onClick={() => setOpen(true)}>Leer aviso completo</button>
      </div>
      {open && (
        <Sheet title="Aviso de salud" onClose={() => setOpen(false)} closeLabel="Cerrar">
          <div className="stack-sm lead"><HealthNoticeBody safety={safety} /></div>
        </Sheet>
      )}
    </aside>
  );
}

/** Completo (perfil inicial y Rutina): lista de avisos y, opcionalmente, la casilla obligatoria. */
export function HealthNoticeFull({ safety, children }: { safety: Safety; children?: ReactNode }) {
  return (
    <section className="notice-full" aria-label="Aviso de salud">
      <div className="hd"><Icon name="info" /><span>Aviso de salud</span></div>
      <HealthNoticeBody safety={safety} />
      {children}
    </section>
  );
}
