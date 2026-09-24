import { expect, test } from './fixtures';
import { createUser, PASSWORD, ROUTINE, signIn, signOut, signUp } from './helpers';

test('crear cuenta: valida los campos antes de enviar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Email').fill('lucia@correo');
  await page.getByLabel('Contraseña', { exact: true }).fill('corta');
  await page.getByLabel('Repite la contraseña').fill('otra');
  await page.getByRole('form', { name: 'Crear cuenta' }).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Escribe un email válido, por ejemplo nombre@correo.com')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
  await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeFocused();
});

test('perfil en 2 pasos: el nombre es obligatorio y se puede volver al paso 1', async ({ page }) => {
  await signUp(page, 'dos-pasos@correo.com');
  await expect(page.getByText('Paso 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Escribe tu nombre.')).toBeVisible();
  await page.getByLabel('Nombre').fill('Lucía');
  await page.getByLabel('Edad').fill('34');
  await page.getByRole('button', { name: 'Mujer', exact: true }).click();
  await page.getByRole('button', { name: 'Perder grasa' }).click();
  await page.getByRole('button', { name: 'Intermedio' }).click();
  await expect(page.getByText('Intermedio: entrenas con regularidad desde hace 6 meses o más.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Paso 2 de 2')).toBeVisible();
  const start = page.getByRole('button', { name: 'Empezar' });
  await expect(start).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Elige una rutina para continuar')).toBeVisible();
  await page.getByRole('button', { name: 'Paso 1' }).click();
  await expect(page.getByLabel('Nombre')).toHaveValue('Lucía');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: ROUTINE.female }).click();
  await start.click();
  await expect(page.getByRole('heading', { name: 'Hola, Lucía' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name: 'Perfil' }).click();
  await expect(page.getByText('34 años')).toBeVisible();
  await expect(page.getByText('Perder grasa')).toBeVisible();
  await expect(page.getByText('Recomposición · 5 días')).toBeVisible();
});

test('contraseña incorrecta: mensaje genérico y sin sesión', async ({ page }) => {
  await createUser(page, 'pw@correo.com', 'Pepa', ROUTINE.male);
  await signOut(page);
  await signIn(page, 'pw@correo.com', 'no-es-la-contraseña');
  await expect(page.getByRole('alert')).toHaveText('El email o la contraseña no son correctos. Revísalos e inténtalo de nuevo.');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
});

test('la sesión se mantiene al recargar y se recupera tras cerrar sesión', async ({ page }) => {
  await createUser(page, 'sesion@correo.com', 'Rosa', ROUTINE.male);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, Rosa' })).toBeVisible();
  await signOut(page);
  await signIn(page, 'sesion@correo.com', PASSWORD);
  await expect(page.getByRole('heading', { name: 'Hola, Rosa' })).toBeVisible();
});

test('modo demo: avisa de que los datos se guardan solo en este navegador', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Modo demo\./)).toBeVisible();
});
