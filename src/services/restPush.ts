/* ==========================================================
   Aviso de fin de descanso aunque la app esté cerrada o en segundo
   plano (notificación push). Solo con Supabase.
   - Este dispositivo se suscribe (permiso + Push API) y la suscripción
     se guarda en push_subscriptions.
   - Al empezar un descanso se apunta la hora de fin en su fila
     (alarm_at). Cada 5 s un cron de Supabase avisa a la Edge Function
     "rest-push", que manda las alarmas vencidas.
   - Si la app está a la vista al terminar el descanso, se cancela:
     ya suena y vibra el temporizador de la app.
   En iPhone solo funciona con la app instalada en la pantalla de inicio.
   ========================================================== */
import type { SupabaseClient } from '@supabase/supabase-js';
import { STORAGE_PREFIX, VAPID_PUBLIC_KEY } from '../config';

export interface RestPush {
  /** El navegador permite notificaciones push. */
  supported(): boolean;
  /** Este dispositivo ya está suscrito para esta persona. */
  isOn(): Promise<boolean>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  /** Programa (o cancela con null) el aviso. No falla: sin conexión simplemente no avisa. */
  schedule(endAt: number | null, title?: string, body?: string): void;
}

const fromB64Url = (s: string) => {
  const b = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};

/** El service worker, o error si la app no lo tiene (p. ej. en desarrollo). */
async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(r => setTimeout(() => r(null), 4000))
  ]);
  if (!reg) throw new Error('Las notificaciones necesitan la app instalada o abierta desde su dirección web (no funcionan en modo desarrollo).');
  return reg;
}

export class SupabaseRestPush implements RestPush {
  private readonly key: string;
  constructor(private readonly c: SupabaseClient, userId: string) {
    this.key = `${STORAGE_PREFIX}:push:${userId}`;
  }

  private get endpoint(): string | null {
    try { return localStorage.getItem(this.key); } catch { return null; }
  }
  private set endpoint(v: string | null) {
    try { if (v) localStorage.setItem(this.key, v); else localStorage.removeItem(this.key); } catch { /* sin almacenamiento */ }
  }

  supported() {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async isOn() {
    if (!this.supported() || !this.endpoint || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return !!sub && sub.endpoint === this.endpoint;
  }

  async enable() {
    if (!this.supported()) throw new Error('Este navegador no permite notificaciones. En iPhone, instala la app en la pantalla de inicio (Compartir › Añadir a pantalla de inicio) y actívalo desde ahí.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('No diste permiso para las notificaciones. Puedes activarlo en los ajustes del navegador o del teléfono.');
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64Url(VAPID_PUBLIC_KEY) });
    const keys = sub.toJSON().keys || {};
    const { error } = await this.c.rpc('register_push', { p_endpoint: sub.endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
    if (error) throw new Error('No se pudo activar el aviso. Inténtalo de nuevo con conexión.');
    this.endpoint = sub.endpoint;
  }

  async disable() {
    const endpoint = this.endpoint;
    this.endpoint = null;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
    } catch { /* ya no estaba */ }
    if (endpoint) await this.c.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }

  schedule(endAt: number | null, title = '', body = '') {
    const endpoint = this.endpoint;
    if (!endpoint) return;
    const patch = endAt == null
      ? { alarm_at: null }
      : { alarm_at: new Date(endAt).toISOString(), alarm_title: title.slice(0, 120), alarm_body: body.slice(0, 200) };
    void Promise.resolve(this.c.from('push_subscriptions').update(patch).eq('endpoint', endpoint)).catch(() => {});
  }
}
