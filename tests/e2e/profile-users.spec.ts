import { expect, test } from './fixtures';
import { completeSet, createUser, PASSWORD, ROUTINE, signIn, signOut, signUp, skipRest, tab, onboard } from './helpers';

const bodyBg = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test('cambio de tema: automático, claro y oscuro, y se recuerda', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await createUser(page, 'tema@correo.com', 'Inés', ROUTINE.male);
  const light = await bodyBg(page);
  await tab(page, 'Perfil');
  await expect(page.getByRole('button', { name: 'Automático' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Oscuro' }).click();
  await expect(page.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
  const dark = await bodyBg(page);
  expect(dark).not.toBe(light);

  await page.reload();
  expect(await bodyBg(page)).toBe(dark);

  // Automático sigue la preferencia del sistema
  await tab(page, 'Perfil');
  await page.getByRole('button', { name: 'Automático' }).click();
  expect(await bodyBg(page)).toBe(light);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => bodyBg(page)).toBe(dark);
  await page.getByRole('button', { name: 'Claro' }).click();
  await expect.poll(() => bodyBg(page)).toBe(light);
});

test('copiar mis datos', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await createUser(page, 'copia@correo.com', 'Olga', ROUTINE.male);
  await tab(page, 'Perfil');
  await page.getByRole('button', { name: 'Copiar mis datos' }).click();
  await expect(page.getByRole('status')).toContainText('Datos copiados');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const json = JSON.parse(text);
  expect(json.email).toBe('copia@correo.com');
  expect(json.profile.name).toBe('Olga');
  expect(text).not.toContain(PASSWORD);
});

test('dos usuarios en el mismo dispositivo no ven los datos del otro', async ({ page }) => {
  await createUser(page, 'uno@correo.com', 'Uno', ROUTINE.male);
  await completeSet(page, { weight: '100', reps: '5', rir: '1' });
  await skipRest(page);
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByLabel('Peso kg').fill('90');
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('button', { name: 'Guardar' }).click();
  await signOut(page);

  // Segunda cuenta: vacía
  await signUp(page, 'dos@correo.com');
  await onboard(page, 'Dos', ROUTINE.male);
  await expect(page.getByText('No iniciado')).toBeVisible();
  await expect(page.getByText('100 kg')).toHaveCount(0);
  await tab(page, 'Historial');
  await expect(page.getByText('Todavía no hay entrenamientos')).toBeVisible();
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(page.getByText('Aún no has registrado tu peso')).toBeVisible();
  await signOut(page);

  // La primera cuenta conserva sus datos tras cerrar sesión y volver a entrar
  await signIn(page, 'uno@correo.com', PASSWORD);
  await expect(page.getByRole('heading', { name: 'Hola, Uno' })).toBeVisible();
  await expect(page.getByText('100 kg × 5, RIR 1')).toBeVisible();
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(page.getByRole('region', { name: 'Registros' })).toContainText('90 kg');
});

test('la navegación por pestañas marca la activa', async ({ page }) => {
  await createUser(page, 'nav@correo.com', 'Nora', ROUTINE.female);
  const nav = page.getByRole('navigation', { name: 'Secciones' });
  for (const name of ['Rutina', 'Progreso', 'Historial', 'Perfil', 'Hoy']) {
    await nav.getByRole('button', { name, exact: true }).click();
    await expect(nav.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await nav.getByRole('button', { name: 'Rutina' }).click();
  await page.getByRole('button', { name: /Día 3 — Pierna: cuádriceps/ }).click();
  await page.getByRole('button', { name: 'Entrenar este día' }).click();
  await expect(page.getByRole('heading', { name: /Día 3 — Pierna: cuádriceps/ })).toBeVisible();
});
