/* Supabase Auth (producción). */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AuthUser } from '../../domain/types';
import { AuthError, normEmail, validateCredentials, type Auth } from './types';

const map = (u: User | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email || '' } : null);

export class SupabaseAuth implements Auth {
  readonly mode = 'supabase' as const;
  readonly client: SupabaseClient;

  constructor(client: SupabaseClient) { this.client = client; }

  async signUp(emailIn: string, password: string): Promise<AuthUser> {
    const email = normEmail(emailIn);
    validateCredentials(email, password);
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new AuthError(error.message);
    if (!data.session) throw new AuthError('Revisa tu email para confirmar la cuenta y después inicia sesión.');
    return map(data.user)!;
  }

  async signIn(emailIn: string, password: string): Promise<AuthUser> {
    const email = normEmail(emailIn);
    if (!email || !password) throw new AuthError('Escribe tu email y tu contraseña.');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new AuthError('El email o la contraseña no son correctos. Revísalos e inténtalo de nuevo.');
    return map(data.user)!;
  }

  async signOut(): Promise<void> { await this.client.auth.signOut(); }

  async getSession(): Promise<AuthUser | null> {
    const { data } = await this.client.auth.getSession();
    return map(data.session?.user);
  }
}
