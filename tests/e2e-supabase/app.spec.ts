/* La app completa contra un proyecto real de Supabase.
   Usa alias de SUPABASE_TEST_EMAIL (.env.supabase.local). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../e2e/fixtures';
import { completeSet, onboard, PASSWORD, ROUTINE, signIn, signOut, skipRest, tab } from '../e2e/helpers';

const env = Object.fromEntries(readFileSync(resolve(process.cwd(), '.env.supabase.local'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const alias = (tag: string) => env.SUPABASE_TEST_EMAIL.replace('@', `+e2e-${tag}-${Date.now()}@`);

// Supabase responde 400 al intento con contraseña incorrecta y el navegador lo registra en consola.
test.use({ allowedConsole: [/\/auth\/v1\/token\?grant_type=password/] });

async function signUpSupabase(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  // En modo Supabase no aparece el aviso de modo demo
  await expect(page.getByText(/Modo demo\./)).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña').fill(PASSWORD);
  await page.getByRole('form', { name: 'Crear cuenta' }).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible();
}

test('flujo completo con Supabase: cuenta, perfil, series, peso, persistencia y dos usuarios', async ({ page }) => {
  const a = alias('a'), b = alias('b');

  // Usuaria A: rutina de 56 años con su aviso obligatorio
  await signUpSupabase(page, a);
  await onboard(page, 'Ana', ROUTINE.safe, { ack: true });
  await completeSet(page, { weight: '30', reps: '12', rir: '3' });
  await expect(page.getByText('En progreso · 1 de 16 series')).toBeVisible();
  await skipRest(page);
  const card = page.getByRole('article', { name: 'Prensa de piernas' });
  await card.getByRole('button', { name: 'Técnica, alternativa y notas' }).click();
  await card.getByLabel('Notas').fill('Asiento en la 4');
  await card.getByLabel('Notas').blur();
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByLabel('Peso kg').fill('68,4');
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('region', { name: 'Registros' })).toContainText('68,4 kg');

  // Recargar: los datos vienen del servidor
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
  await expect(page.getByText('30 kg × 12, RIR 3')).toBeVisible();
  await tab(page, 'Perfil');
  await expect(page.getByText(/Aceptado el/)).toBeVisible();
  await signOut(page);

  // Usuaria B: no ve nada de A
  await signUpSupabase(page, b);
  await onboard(page, 'Bea', ROUTINE.male);
  await expect(page.getByText('No iniciado')).toBeVisible();
  await tab(page, 'Historial');
  await expect(page.getByText('Todavía no hay entrenamientos')).toBeVisible();
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(page.getByText('Aún no has registrado tu peso')).toBeVisible();
  await signOut(page);

  // Contraseña incorrecta y vuelta de A con todo intacto
  await signIn(page, a, 'no-es-la-contraseña');
  await expect(page.getByRole('alert')).toContainText('El email o la contraseña no son correctos');
  await signIn(page, a, PASSWORD);
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
  await expect(page.getByText('30 kg × 12, RIR 3')).toBeVisible();
  const again = page.getByRole('article', { name: 'Prensa de piernas' });
  await again.getByRole('button', { name: 'Técnica, alternativa y notas' }).click();
  await expect(again.getByLabel('Notas')).toHaveValue('Asiento en la 4');

  // Borrar el entrenamiento de prueba
  await tab(page, 'Historial');
  await page.getByRole('button', { name: /Día A — Pierna y tracción/ }).click();
  await page.getByRole('button', { name: 'Eliminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByText('Todavía no hay entrenamientos')).toBeVisible();
});
