/* Supabase Auth (producción). */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { STORAGE_PREFIX } from '../../config';
import type { AuthUser } from '../../domain/types';
import { AuthError, normEmail, validateCredentials, type Auth } from './types';

const map = (u: User | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email || '' } : null);

/** Último usuario con sesión en este dispositivo: permite abrir la app sin conexión
    aunque el token haya caducado (se renueva al volver la red). */
export const LAST_USER_KEY = `${STORAGE_PREFIX}:last-user`;
const remember = (u: AuthUser | null) => {
  try { if (u) localStorage.setItem(LAST_USER_KEY, JSON.stringify(u)); else localStorage.removeItem(LAST_USER_KEY); } catch { /* sin almacenamiento */ }
};
const remembered = (): AuthUser | null => {
  try { return JSON.parse(localStorage.getItem(LAST_USER_KEY) || 'null'); } catch { return null; }
};
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Traduce los errores de Supabase Auth que puede ver la persona. */
function authMessage(e: { message: string; status?: number; code?: string }, fallback: string): string {
  if (offline() || /fetch|network/i.test(e.message)) return 'Sin conexión. Para esto necesitas internet.';
  if (e.status === 429 || /rate limit/i.test(e.message)) return 'Demasiados intentos en poco tiempo. Espera unos minutos e inténtalo de nuevo.';
  if (/not confirmed/i.test(e.message)) return 'Confirma tu email con el enlace que te hemos enviado y vuelve a intentarlo.';
  if (/already registered|already exists/i.test(e.message)) return 'Ya existe una cuenta con ese email. Inicia sesión.';
  if (/password/i.test(e.message) && /weak|short|least/i.test(e.message)) return 'La contraseña es demasiado débil. Usa al menos 8 caracteres.';
  if (/email/i.test(e.message) && /invalid/i.test(e.message)) return 'Escribe un email válido, por ejemplo nombre@correo.com';
  return fallback;
}

export class SupabaseAuth implements Auth {
  readonly mode = 'supabase' as const;
  readonly client: SupabaseClient;

  constructor(client: SupabaseClient) { this.client = client; }

  async signUp(emailIn: string, password: string): Promise<AuthUser> {
    const email = normEmail(emailIn);
    validateCredentials(email, password);
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new AuthError(authMessage(error, 'No se pudo crear la cuenta. Inténtalo de nuevo.'));
    if (!data.session) throw new AuthError('Revisa tu email para confirmar la cuenta y después inicia sesión.');
    const u = map(data.user)!;
    remember(u);
    return u;
  }

  async signIn(emailIn: string, password: string): Promise<AuthUser> {
    const email = normEmail(emailIn);
    if (!email || !password) throw new AuthError('Escribe tu email y tu contraseña.');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new AuthError(authMessage(error, 'El email o la contraseña no son correctos. Revísalos e inténtalo de nuevo.'));
    const u = map(data.user)!;
    remember(u);
    return u;
  }

  async signOut(): Promise<void> {
    remember(null);
    // Con conexión se invalida la sesión en el servidor; sin conexión, al menos en este dispositivo
    const { error } = await this.client.auth.signOut(offline() ? { scope: 'local' } : undefined);
    if (error) await this.client.auth.signOut({ scope: 'local' });
  }

  async getSession(): Promise<AuthUser | null> {
    const { data, error } = await this.client.auth.getSession();
    const u = map(data.session?.user);
    if (u) { remember(u); return u; }
    // Sin red no se puede renovar el token: se abre con el último usuario de este dispositivo
    if (offline() || (error && /fetch|network/i.test(error.message))) return remembered();
    return null;
  }
}
