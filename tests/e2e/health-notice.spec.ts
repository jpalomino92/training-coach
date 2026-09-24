import { expect, test } from './fixtures';
import { ROUTINE, signUp, tab } from './helpers';

const WARNING_1 = 'Debido al antecedente de cirugía de columna y artrosis, esta rutina debe ser revisada por el médico, fisioterapeuta o profesional sanitario que conozca tu historial antes de comenzar.';
const WARNING_2 = 'Si aparece dolor agudo, irradiado, hormigueo, entumecimiento o síntomas neurológicos, detener el ejercicio y consultar a un profesional sanitario.';
const ACK = 'He leído el aviso y revisaré esta rutina con mi médico o fisioterapeuta antes de empezar.';

test('rutina de 56 años: el aviso es obligatorio y sus textos son literales', async ({ page }) => {
  await signUp(page, 'carmen@correo.com');
  await page.getByLabel('Nombre').fill('Carmen');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Las otras rutinas no piden aviso
  await page.getByRole('button', { name: ROUTINE.male }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  await page.getByRole('button', { name: ROUTINE.safe }).click();
  const notice = page.getByRole('region', { name: 'Aviso de salud' });
  await expect(notice.getByText(WARNING_1, { exact: true })).toBeVisible();
  await expect(notice.getByText(WARNING_2, { exact: true })).toBeVisible();

  const start = page.getByRole('button', { name: 'Empezar' });
  await expect(start).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Marca la casilla del aviso para continuar')).toBeVisible();
  // Sigue siendo enfocable, pero pulsarlo no hace nada
  await start.press('Enter');
  await expect(page.getByRole('heading', { name: 'Elige tu rutina' })).toBeVisible();

  await page.getByRole('checkbox', { name: ACK }).check();
  await expect(start).not.toHaveAttribute('aria-disabled');
  await start.click();

  // Hoy muestra el aviso compacto y el completo en una hoja inferior
  await expect(page.getByRole('heading', { name: 'Hola, Carmen' })).toBeVisible();
  const compact = page.getByRole('complementary', { name: 'Aviso de salud' });
  await expect(compact).toContainText(WARNING_2);
  await compact.getByRole('button', { name: 'Leer aviso completo' }).click();
  const sheet = page.getByRole('dialog', { name: 'Aviso de salud' });
  await expect(sheet.getByText(WARNING_1, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // Se guarda la fecha de aceptación
  await tab(page, 'Perfil');
  await expect(page.getByText(/Aceptado el \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
});

test('al cambiar a la rutina de 56 años desde Editar perfil hay que aceptar el aviso', async ({ page }) => {
  await signUp(page, 'cambio@correo.com');
  await page.getByLabel('Nombre').fill('Marta');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: ROUTINE.female }).click();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await tab(page, 'Perfil');
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: ROUTINE.safe }).click();
  const save = page.getByRole('button', { name: 'Guardar cambios' });
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('checkbox', { name: ACK }).check();
  await save.click();
  await expect(page.getByText('Fuerza segura · 3 días')).toBeVisible();
});
