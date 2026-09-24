import { describe, expect, it } from 'vitest';
import { DemoAuth, PBKDF2_ITERATIONS, SESSION_KEY, USERS_KEY, type StoredUser } from '../../src/services/auth/demoAuth';

const FAST = 1000; // iteraciones reducidas para que las pruebas sean rápidas
const PASSWORD = 'secreto-muy-largo-123';

describe('autenticación demo', () => {
  it('registro: crea la cuenta e inicia sesión', async () => {
    const auth = new DemoAuth(localStorage, FAST);
    const u = await auth.signUp('  Ana@Correo.COM ', PASSWORD);
    expect(u.email).toBe('ana@correo.com');
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await auth.getSession()).toEqual(u);
  });

  it('registro: valida email y longitud de contraseña', async () => {
    const auth = new DemoAuth(localStorage, FAST);
    await expect(auth.signUp('no-es-email', PASSWORD)).rejects.toThrow(/email válido/);
    await expect(auth.signUp('a@b.com', 'corta')).rejects.toThrow(/8 caracteres/);
  });

  it('registro: no permite dos cuentas con el mismo email', async () => {
    const auth = new DemoAuth(localStorage, FAST);
    await auth.signUp('ana@correo.com', PASSWORD);
    await expect(auth.signUp('ANA@correo.com', PASSWORD)).rejects.toThrow(/Ya existe/);
  });

  it('inicio de sesión con la contraseña correcta', async () => {
    const auth = new DemoAuth(localStorage, FAST);
    const u = await auth.signUp('ana@correo.com', PASSWORD);
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(await auth.signIn('ana@correo.com', PASSWORD)).toEqual(u);
    expect(await auth.getSession()).toEqual(u);
  });

  it('contraseña incorrecta o email desconocido: mismo mensaje y sin sesión', async () => {
    const auth = new DemoAuth(localStorage, FAST);
    await auth.signUp('ana@correo.com', PASSWORD);
    await auth.signOut();
    await expect(auth.signIn('ana@correo.com', 'otra-contraseña')).rejects.toThrow('El email o la contraseña no son correctos');
    await expect(auth.signIn('nadie@correo.com', PASSWORD)).rejects.toThrow('El email o la contraseña no son correctos');
    expect(await auth.getSession()).toBeNull();
  });

  it('guarda solo un hash PBKDF2 con sal: nunca la contraseña en claro', async () => {
    const auth = new DemoAuth(localStorage);
    await auth.signUp('ana@correo.com', PASSWORD);
    await auth.signUp('bea@correo.com', PASSWORD);
    const all = Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n');
    expect(all).not.toContain(PASSWORD);
    const users: StoredUser[] = JSON.parse(localStorage.getItem(USERS_KEY)!);
    expect(users).toHaveLength(2);
    for (const u of users) {
      expect(Object.keys(u).sort()).toEqual(['created_at', 'email', 'hash', 'id', 'iter', 'salt']);
      expect(u.iter).toBe(PBKDF2_ITERATIONS);
      expect(atob(u.hash)).toHaveLength(32);
      expect(atob(u.salt)).toHaveLength(16);
    }
    // Misma contraseña, sal distinta → hash distinto
    expect(users[0].hash).not.toBe(users[1].hash);
    expect(localStorage.getItem(SESSION_KEY)).not.toContain('hash');
  });

  it('una sesión de un usuario borrado no es válida', async () => {
    const auth = new DemoAuth(localStorage, FAST);
    await auth.signUp('ana@correo.com', PASSWORD);
    localStorage.setItem(USERS_KEY, '[]');
    expect(await auth.getSession()).toBeNull();
  });
});
