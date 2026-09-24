/* DemoAuth: la contraseña NUNCA se guarda. Solo un hash PBKDF2-SHA256
   con sal aleatoria. Es un modo de prueba: todo vive en este dispositivo
   y no sustituye a un backend real. */
import { STORAGE_PREFIX } from '../../config';
import type { AuthUser } from '../../domain/types';
import { uid } from '../uid';
import { AuthError, normEmail, validateCredentials, validateNewPassword, type Auth } from './types';

export const USERS_KEY = `${STORAGE_PREFIX}:users`;
export const SESSION_KEY = `${STORAGE_PREFIX}:session`;
export const PBKDF2_ITERATIONS = 150_000;

export interface StoredUser {
  id: string;
  email: string;
  salt: string;
  hash: string;
  iter: number;
  created_at: string;
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new AuthError('Este navegador no permite el cifrado necesario. Abre la app desde https o localhost.');
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return b64(bits);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export class DemoAuth implements Auth {
  readonly mode = 'demo' as const;
  private readonly storage: Storage;
  private readonly iterations: number;

  constructor(storage: Storage = localStorage, iterations = PBKDF2_ITERATIONS) {
    this.storage = storage;
    this.iterations = iterations;
  }

  private users(): StoredUser[] {
    try { return JSON.parse(this.storage.getItem(USERS_KEY) || '[]') || []; } catch { return []; }
  }
  private saveUsers(u: StoredUser[]) { this.storage.setItem(USERS_KEY, JSON.stringify(u)); }
  private setSession(u: AuthUser) { this.storage.setItem(SESSION_KEY, JSON.stringify({ id: u.id, email: u.email })); }

  async signUp(emailIn: string, password: string): Promise<AuthUser> {
    const email = normEmail(emailIn);
    validateCredentials(email, password);
    const users = this.users();
    if (users.some(u => u.email === email)) throw new AuthError('Ya existe una cuenta con ese email en este dispositivo. Inicia sesión.', 'email');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const user: StoredUser = { id: uid(), email, salt: b64(salt), hash: await derive(password, salt, this.iterations), iter: this.iterations, created_at: new Date().toISOString() };
    users.push(user);
    this.saveUsers(users);
    this.setSession(user);
    return { id: user.id, email };
  }

  async signIn(emailIn: string, password: string): Promise<AuthUser> {
    const email = normEmail(emailIn);
    if (!email || !password) throw new AuthError('Escribe tu email y tu contraseña.');
    const u = this.users().find(x => x.email === email);
    const fail = new AuthError('El email o la contraseña no son correctos. Revísalos e inténtalo de nuevo.');
    if (!u) { await derive(password, new Uint8Array(16), Math.min(1000, this.iterations)); throw fail; }
    const h = await derive(password, unb64(u.salt), u.iter || this.iterations);
    if (!safeEqual(h, u.hash)) throw fail;
    this.setSession(u);
    return { id: u.id, email: u.email };
  }

  async signOut(): Promise<void> { this.storage.removeItem(SESSION_KEY); }

  async requestPasswordReset(): Promise<void> {
    throw new AuthError('En modo demo no se pueden enviar correos: las cuentas solo existen en este navegador, así que no hay forma de recuperar la contraseña. Puedes crear una cuenta nueva.');
  }

  async updatePassword(newPassword: string, current?: string): Promise<void> {
    const session = await this.getSession();
    if (!session) throw new AuthError('Inicia sesión para cambiar la contraseña.');
    validateNewPassword(newPassword);
    const users = this.users();
    const u = users.find(x => x.id === session.id)!;
    const ok = current != null && safeEqual(await derive(current, unb64(u.salt), u.iter || this.iterations), u.hash);
    if (!ok) throw new AuthError('La contraseña actual no es correcta.', 'password');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    Object.assign(u, { salt: b64(salt), hash: await derive(newPassword, salt, this.iterations), iter: this.iterations });
    this.saveUsers(users);
  }

  isRecovery() { return false; }
  recoveryFailed() { return false; }
  finishRecovery() { /* el modo demo no tiene enlaces de recuperación */ }

  async getSession(): Promise<AuthUser | null> {
    try {
      const s = JSON.parse(this.storage.getItem(SESSION_KEY) || 'null') as AuthUser | null;
      if (s && this.users().some(u => u.id === s.id)) return { id: s.id, email: s.email };
    } catch { /* sin sesión */ }
    return null;
  }
}
