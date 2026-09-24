/* Fixture común: cualquier error o aviso en consola hace fallar la prueba. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ consoleGuard: void; allowedConsole: RegExp | null }>({
  /** Mensajes esperados que no cuentan como error (p. ej. el 400 de una contraseña incorrecta en Supabase). */
  allowedConsole: [null, { option: true }],
  consoleGuard: [async ({ page, allowedConsole }, use) => {
    const problems: string[] = [];
    page.on('console', m => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      const text = `${m.type()}: ${m.text()}`;
      if (!allowedConsole || !(allowedConsole.test(text) || allowedConsole.test(m.location().url))) problems.push(text);
    });
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    await use();
    expect(problems, 'Sin errores ni avisos en consola').toEqual([]);
  }, { auto: true }]
});

export { expect };
