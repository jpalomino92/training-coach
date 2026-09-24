/* Entrenar sin conexión con Supabase: los cambios se guardan en el dispositivo,
   la app abre sin red y todo llega al servidor al volver la conexión. */
import { expect, test } from '../e2e/fixtures';
import { completeSet, onboard, ROUTINE, signIn, skipRest, tab } from '../e2e/helpers';
import { resetAccount, TEST_PASSWORD, testEmail } from './rest';

// Sin conexión el navegador registra las peticiones que no pueden salir; es lo esperado aquí.
test.use({ allowedConsole: /ERR_INTERNET_DISCONNECTED|Failed to fetch/ });

test.beforeEach(async () => { await resetAccount('test-a'); });

test('sin conexión: registrar, cerrar y abrir la app, y sincronizar al volver la red', async ({ page, context, browser }) => {
  const email = testEmail('test-a');
  await page.goto('/');
  await signIn(page, email, TEST_PASSWORD);
  await onboard(page, 'Olga', ROUTINE.male);
  await expect(page.getByText(/cambios? pendientes?/)).toHaveCount(0);

  // El service worker ya controla la página (la app abre sin red)
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30_000 });

  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible();

  await completeSet(page, { weight: '60', reps: '8', rir: '2' });
  await skipRest(page);
  await completeSet(page, { reps: '7' });
  await skipRest(page);
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByLabel('Peso kg').fill('81,2');
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/Sin conexión · \d+ cambios pendientes de enviar/)).toBeVisible();

  // Cerrar y volver a abrir sin conexión: todo sigue ahí
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Olga' })).toBeVisible();
  await expect(page.getByText('60 kg × 7, RIR 2')).toBeVisible();
  await expect(page.getByText(/cambios pendientes de enviar/)).toBeVisible();

  // Vuelve la red: se envía la cola y el aviso desaparece
  await context.setOffline(false);
  await expect(page.getByText(/cambios? pendientes?|Sin conexión/)).toHaveCount(0, { timeout: 30_000 });

  // Otro dispositivo (contexto nuevo, sin copia local): los datos están en el servidor
  const other = await browser.newContext({ locale: 'es-ES' });
  const p2 = await other.newPage();
  await p2.goto('/');
  await signIn(p2, email, TEST_PASSWORD);
  await expect(p2.getByRole('heading', { name: 'Hola, Olga' })).toBeVisible();
  await expect(p2.getByText('60 kg × 8, RIR 2')).toBeVisible();
  await expect(p2.getByText('60 kg × 7, RIR 2')).toBeVisible();
  await tab(p2, 'Progreso');
  await p2.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(p2.getByRole('region', { name: 'Registros' })).toContainText('81,2 kg');
  await other.close();
});
