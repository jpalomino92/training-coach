/* Mantiene la pantalla encendida mientras `active` (Screen Wake Lock API).
   El sistema la libera al cambiar de pestaña: se vuelve a pedir al volver. */
import { useEffect } from 'react';

interface Sentinel { release(): Promise<void>; released?: boolean }
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Sentinel> } };

export function useWakeLock(active: boolean) {
  useEffect(() => {
    const nav = navigator as WakeLockNav;
    if (!active || !nav.wakeLock) return;
    let lock: Sentinel | null = null;
    let cancelled = false;
    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try { lock = await nav.wakeLock!.request('screen'); if (cancelled) void lock.release(); } catch { /* no permitido (batería baja, etc.) */ }
    };
    const onVis = () => { if (document.visibilityState === 'visible' && (!lock || lock.released)) void request(); };
    void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      if (lock && !lock.released) void lock.release().catch(() => {});
    };
  }, [active]);
}
