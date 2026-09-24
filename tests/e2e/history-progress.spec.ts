import { expect, test } from './fixtures';
import { completeSet, createUser, ROUTINE, skipRest, tab } from './helpers';

async function finishWithSets(page: import('@playwright/test').Page, weight: string, n = 4) {
  for (let i = 0; i < n; i++) {
    await completeSet(page, i === 0 ? { weight, reps: '10', rir: '2' } : {});
    await skipRest(page);
  }
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
}

test('historial: detalle por ejercicio y borrado con confirmación dentro de la tarjeta', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-21T10:00:00'));
  await createUser(page, 'historial@correo.com', 'Lola', ROUTINE.male);
  await tab(page, 'Historial');
  await expect(page.getByText('Todavía no hay entrenamientos')).toBeVisible();
  await tab(page, 'Hoy');
  await finishWithSets(page, '80');

  await tab(page, 'Historial');
  await expect(page.getByText('Septiembre 2026')).toBeVisible();
  const row = page.getByRole('button', { name: /Lun 21\/09 · Pierna A — Cuádriceps/ });
  await expect(row).toContainText('◐ Terminado con 4 de 23 series');
  await row.click();
  await expect(page.getByText('Sentadilla con barra')).toBeVisible();
  await expect(page.getByText('80 kg × 10 / 10 / 10 / 10 · RIR 2')).toBeVisible();

  await page.getByRole('button', { name: 'Eliminar entrenamiento' }).click();
  await expect(page.getByText('¿Eliminar este entrenamiento? No se puede deshacer.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Entrenamiento eliminado');
  await expect(page.getByText('Todavía no hay entrenamientos')).toBeVisible();
});

test('progreso: un punto por semana con el peso máximo y filtro por día', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-07T10:00:00'));
  await createUser(page, 'progreso@correo.com', 'Julia', ROUTINE.male);
  await tab(page, 'Progreso');
  await expect(page.getByText('Aún no hay progreso')).toBeVisible();
  await tab(page, 'Hoy');
  await finishWithSets(page, '80');

  await page.clock.setFixedTime(new Date('2026-09-15T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^PA,/ }).click();
  await finishWithSets(page, '85');

  await tab(page, 'Progreso');
  await expect(page.getByText('entrenamientos completados')).toBeVisible();
  const card = page.getByRole('region', { name: 'Sentadilla con barra' });
  await expect(card).toContainText('85 kg');
  await expect(card).toContainText('Semana 1 → 80 kg');
  await expect(card).toContainText('Semana 2 → 85 kg');
  await expect(card.getByRole('img', { name: /sube, de 80 kg en la semana 1 a 85 kg en la semana 2/ })).toBeVisible();

  await page.getByRole('button', { name: 'TA, Torso A' }).click();
  await expect(page.getByText('Todavía no hay series registradas en este día.')).toBeVisible();
  await page.getByRole('button', { name: 'Todos' }).click();
  await expect(card).toBeVisible();
});

test('peso corporal: registrar, editar con nota y ocultarlo desde el perfil', async ({ page }) => {
  await createUser(page, 'peso@correo.com', 'Clara', ROUTINE.female);
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(page.getByText('Aún no has registrado tu peso')).toBeVisible();

  await page.getByRole('button', { name: 'Registrar peso' }).click();
  const sheet = page.getByRole('dialog', { name: 'Registrar peso' });
  await sheet.getByLabel('Peso kg').fill('74,5');
  await sheet.getByRole('button', { name: 'Sumar 0,1 kg' }).click();
  await expect(sheet.getByLabel('Peso kg')).toHaveValue('74,6');
  await sheet.getByLabel('Fecha').fill('2026-09-20');
  await sheet.getByLabel(/Nota/).fill('En ayunas');
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(sheet).toHaveCount(0);

  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByLabel('Peso kg').fill('74,1');
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('button', { name: 'Guardar' }).click();

  const hero = page.getByRole('region', { name: /Último registro/ });
  await expect(hero).toContainText('74,1');
  await expect(hero).toContainText('0,5 kg desde el 20/09');
  const list = page.getByRole('region', { name: 'Registros' });
  await expect(list).toContainText('En ayunas');

  await list.getByRole('button', { name: 'Editar el registro del 20/09/2026' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar peso' });
  await edit.getByLabel('Peso kg').fill('74,8');
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(list).toContainText('74,8 kg');

  // Apagado: Progreso no muestra el selector; los datos se conservan
  await tab(page, 'Perfil');
  const sw = page.getByRole('switch', { name: 'Mostrar peso corporal' });
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await tab(page, 'Progreso');
  await expect(page.getByRole('button', { name: 'Peso corporal' })).toHaveCount(0);
  await tab(page, 'Perfil');
  await page.getByRole('switch', { name: 'Mostrar peso corporal' }).click();
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(page.getByRole('region', { name: 'Registros' })).toContainText('74,8 kg');
});
