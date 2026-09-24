/* Enlace de invitación: https://…/?invitacion=CODIGO
   Se guarda al abrir la app (antes de iniciar sesión) y se quita de la barra de direcciones. */
import { STORAGE_PREFIX } from '../config';

const KEY = `${STORAGE_PREFIX}:invite`;
export const INVITE_PARAM = 'invitacion';

export function captureInvite(): void {
  try {
    const url = new URL(location.href);
    const code = url.searchParams.get(INVITE_PARAM);
    if (!code) return;
    sessionStorage.setItem(KEY, code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
    url.searchParams.delete(INVITE_PARAM);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch { /* sin almacenamiento: se escribe el código a mano */ }
}

export function pendingInvite(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function clearInvite(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nada */ }
}

export const inviteUrl = (code: string) => `${location.origin}/?${INVITE_PARAM}=${code}`;
