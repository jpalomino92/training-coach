/* Interfaz común de autenticación para el modo demo y Supabase. */
import type { AuthUser } from '../../domain/types';

export interface Auth {
  readonly mode: 'demo' | 'supabase';
  signUp(email: string, password: string): Promise<AuthUser>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthUser | null>;
  /** Envía el enlace para elegir una contraseña nueva. No revela si el email tiene cuenta. */
  requestPasswordReset(email: string): Promise<void>;
  /** Cambia la contraseña de la sesión actual. `current` es obligatoria salvo al venir de un enlace de recuperación. */
  updatePassword(newPassword: string, current?: string): Promise<void>;
  /** La app se abrió desde un enlace de recuperación de contraseña. */
  isRecovery(): boolean;
  /** El enlace de recuperación ha caducado o ya se usó. */
  recoveryFailed(): boolean;
  /** Limpia la marca de recuperación (y la URL). */
  finishRecovery(): void;
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

export function validateNewPassword(password: string) {
  if (!password || password.length < MIN_PASSWORD) throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, 'password');
}

export function validateCredentials(email: string, password: string) {
  if (!isValidEmail(email)) throw new AuthError('Escribe un email válido, por ejemplo nombre@correo.com', 'email');
  if (!password || password.length < MIN_PASSWORD) throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, 'password');
}
