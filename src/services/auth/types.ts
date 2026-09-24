/* Interfaz común de autenticación para el modo demo y Supabase. */
import type { AuthUser } from '../../domain/types';

export interface Auth {
  readonly mode: 'demo' | 'supabase';
  signUp(email: string, password: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthUser | null>;
}

/** Error mostrable al usuario. `field` indica qué campo lo causó, si aplica. */
export class AuthError extends Error {
  readonly field?: 'email' | 'password' | 'password2';
  constructor(message: string, field?: 'email' | 'password' | 'password2') {
    super(message);
    this.name = 'AuthError';
    this.field = field;
  }
}

export const normEmail = (e: string) => String(e || '').trim().toLowerCase();
export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const MIN_PASSWORD = 8;

export function validateCredentials(email: string, password: string) {
  if (!isValidEmail(email)) throw new AuthError('Escribe un email válido, por ejemplo nombre@correo.com', 'email');
  if (!password || password.length < MIN_PASSWORD) throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, 'password');
}
