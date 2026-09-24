/* La app completa (build de producción) contra el proyecto real de Supabase.
   Usa las cuentas fijas de prueba, que se vacían antes de empezar. */
import { expect, test } from '../e2e/fixtures';
import { completeSet, onboard, ROUTINE, signIn, signOut, skipRest, tab } from '../e2e/helpers';
import { resetAccount, TEST_PASSWORD, testEmail } from './rest';

// Supabase responde 400 al intento con contraseña incorrecta y el navegador lo registra en consola.
test.use({ allowedConsole: /\/auth\/v1\/token\?grant_type=password/ });

test.beforeEach(async () => { await resetAccount('test-a'); await resetAccount('test-b'); });

test('flujo completo con Supabase: perfil, series, notas, peso, persistencia y dos usuarios', async ({ page }) => {
  const a = testEmail('test-a'), b = testEmail('test-b');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  // En modo Supabase no aparece el aviso de modo demo
  await expect(page.getByText(/Modo demo\./)).toHaveCount(0);

  // Usuaria A: rutina de 56 años con su aviso obligatorio
  await signIn(page, a, TEST_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible();
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
  // Todo enviado al servidor antes de seguir
  await expect(page.getByText(/cambios? pendientes?/)).toHaveCount(0);

  // Recargar: los datos vienen del servidor
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
  await expect(page.getByText('30 kg × 12, RIR 3')).toBeVisible();
  await tab(page, 'Perfil');
  await expect(page.getByText(/Aceptado el/)).toBeVisible();
  await signOut(page);

  // Usuaria B: no ve nada de A
  await signIn(page, b, TEST_PASSWORD);
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
  await signIn(page, a, TEST_PASSWORD);
  await expect(page.getByRole('heading', { name: 'Hola, Ana' })).toBeVisible();
  await expect(page.getByText('30 kg × 12, RIR 3')).toBeVisible();
  const again = page.getByRole('article', { name: 'Prensa de piernas' });
  await again.getByRole('button', { name: 'Técnica, alternativa y notas' }).click();
  await expect(again.getByLabel('Notas')).toHaveValue('Asiento en la 4');
});
