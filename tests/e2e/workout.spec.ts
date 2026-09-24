import { expect, test } from './fixtures';
import { completeSet, completeWholeDay, createUser, currentSet, ROUTINE, skipRest, tab } from './helpers';

test('registrar, editar y borrar series', async ({ page }) => {
  await createUser(page, 'series@correo.com', 'Ana', ROUTINE.male);
  const card = page.getByRole('article', { name: 'Sentadilla con barra' });
  await expect(page.getByText('No iniciado')).toBeVisible();

  // Sin valores el botón está deshabilitado y explica el motivo
  await expect(currentSet(page).getByRole('button', { name: 'Completar serie' })).toHaveAttribute('aria-disabled', 'true');
  await expect(card.getByText('Escribe el peso y las repeticiones')).toBeVisible();

  // Error de validación al completar
  await completeSet(page, { weight: '80', reps: '99', rir: '2' });
  await expect(card.getByText('Escribe cuántas repeticiones hiciste (entre 1 y 50).')).toBeVisible();

  // − / + usan el paso del ejercicio (2,5 kg)
  await currentSet(page).getByRole('button', { name: 'Sumar 2,5 kg' }).click();
  await expect(currentSet(page).getByLabel('Peso kg')).toHaveValue('82,5');

  await completeSet(page, { reps: '8' });
  await expect(card.getByRole('status')).toContainText('Serie registrada');
  await expect(page.getByText('En progreso · 1 de 23 series')).toBeVisible();
  await skipRest(page);

  // La serie 2 llega rellenada con la anterior de hoy
  await expect(currentSet(page)).toHaveAccessibleName('Serie 2 de 4');
  await expect(currentSet(page).getByLabel('Peso kg')).toHaveValue('82,5');
  await completeSet(page);
  await skipRest(page);

  // Editar la serie 1 en su sitio
  await card.getByRole('button', { name: 'Editar serie 1' }).click();
  const edit = page.getByRole('form', { name: 'Editar serie 1' });
  await edit.getByLabel(/^Reps$/).fill('7');
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(card.getByText('82,5 kg × 7, RIR 2')).toBeVisible();

  // Borrar la serie 2
  await card.getByRole('button', { name: 'Editar serie 2' }).click();
  await page.getByRole('form', { name: 'Editar serie 2' }).getByRole('button', { name: 'Eliminar serie' }).click();
  await expect(page.getByText('En progreso · 1 de 23 series')).toBeVisible();

  // Todo sigue ahí al recargar
  await page.reload();
  await expect(page.getByRole('article', { name: 'Sentadilla con barra' }).getByText('82,5 kg × 7, RIR 2')).toBeVisible();
});

test('finalización automática al registrar la última serie del día', async ({ page }) => {
  await createUser(page, 'auto@correo.com', 'Carmen', ROUTINE.safe, { ack: true });
  await completeWholeDay(page);
  await expect(page.getByText(/^Entrenamiento completado el \d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /SA, Día A.*completado/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Terminar entrenamiento' })).toHaveCount(0);
  await tab(page, 'Historial');
  await expect(page.getByText('✓ Completado · 16 series')).toBeVisible();
});

test('finalización manual con series pendientes pide confirmación', async ({ page }) => {
  await createUser(page, 'manual@correo.com', 'Luis', ROUTINE.male);
  await completeSet(page, { weight: '60', reps: '8', rir: '2' });
  await skipRest(page);
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await expect(page.getByText('Quedan 22 series sin registrar.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await expect(page.getByText(/^Entrenamiento completado el/)).toBeVisible();
  await tab(page, 'Historial');
  await expect(page.getByText('◐ Terminado con 1 de 23 series')).toBeVisible();
});

test('notas por ejercicio: se guardan solas y se ven la próxima vez', async ({ page }) => {
  await createUser(page, 'notas@correo.com', 'Eva', ROUTINE.female);
  const card = page.getByRole('article', { name: 'Hip thrust con barra' });
  await card.getByRole('button', { name: 'Técnica, alternativa y notas' }).click();
  await expect(card.getByText('Espalda alta apoyada en el banco y mentón hacia el pecho. Sube hasta alinear tronco y muslos y aprieta 1 s.')).toBeVisible();
  await card.getByLabel('Notas').fill('Banco en la posición 3');
  await card.getByLabel('Notas').blur();
  await page.reload();
  const again = page.getByRole('article', { name: 'Hip thrust con barra' });
  await again.getByRole('button', { name: 'Técnica, alternativa y notas' }).click();
  await expect(again.getByLabel('Notas')).toHaveValue('Banco en la posición 3');
});

test('dolor: se distingue de la molestia muscular y la sesión siguiente muestra la alerta', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-21T10:00:00'));
  await createUser(page, 'dolor@correo.com', 'Nuria', ROUTINE.female);
  const card = page.getByRole('article', { name: 'Hip thrust con barra' });
  for (let i = 0; i < 4; i++) {
    await completeSet(page, i === 0 ? { weight: '50', reps: '10', rir: '2' } : {});
    await skipRest(page);
  }
  const feel = card.getByRole('group', { name: '¿Cómo lo sentiste hoy?' });
  await expect(feel.getByRole('button', { name: 'Molestia muscular' })).toBeVisible();
  await feel.getByRole('button', { name: 'Dolor articular, de espalda o neurológico' }).click();
  await expect(feel.getByRole('button', { name: 'Dolor articular, de espalda o neurológico' })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('alert')).toContainText('detén el ejercicio');
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();

  // Dos días después, mismo día de la rutina
  await page.clock.setFixedTime(new Date('2026-09-23T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^F1,/ }).click();
  const next = page.getByRole('article', { name: 'Hip thrust con barra' });
  const alert = next.getByRole('alert');
  await expect(alert).toContainText('Registraste dolor el 21/09/2026');
  await expect(alert).toContainText('No aumentes el peso.');
  await alert.getByRole('button', { name: /Ver alternativa: hip thrust en máquina/ }).click();
  await expect(next.getByLabel('Alternativa')).toHaveText('Hip thrust en máquina o puente de glúteo con barra');
  await expect(next.getByLabel('Alternativa')).toBeFocused();
  // La sugerencia nunca cambia el peso: sigue el de la última sesión
  await expect(currentSet(page).getByLabel('Peso kg')).toHaveValue('50');
});

test('molestia muscular normal no bloquea la sugerencia de subir', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-21T10:00:00'));
  await createUser(page, 'molestia@correo.com', 'Irene', ROUTINE.female);
  for (let i = 0; i < 4; i++) {
    await completeSet(page, i === 0 ? { weight: '50', reps: '12', rir: '2' } : {});
    await skipRest(page);
  }
  await page.getByRole('article', { name: 'Hip thrust con barra' }).getByRole('button', { name: 'Molestia muscular' }).click();
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await page.clock.setFixedTime(new Date('2026-09-24T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^F1,/ }).click();
  const card = page.getByRole('article', { name: 'Hip thrust con barra' });
  await expect(card.getByText('Sube a 52,5 kg.')).toBeVisible();
  // La persona decide: el campo sigue con el peso de la última sesión
  await expect(currentSet(page).getByLabel('Peso kg')).toHaveValue('50');
});

test('temporizador de descanso: +15 s, visible en otras pestañas y se cierra solo', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T10:00:00') });
  await createUser(page, 'timer@correo.com', 'Sara', ROUTINE.male);
  await completeSet(page, { weight: '60', reps: '8', rir: '2' });
  const timer = page.getByRole('region', { name: 'Temporizador de descanso' });
  await expect(timer).toContainText('Descanso · luego serie 2 de 4');
  await expect(timer.getByRole('timer')).toHaveText('2:30');
  await timer.getByRole('button', { name: 'Añadir 15 segundos' }).click();
  await expect(timer.getByRole('timer')).toHaveText('2:45');

  await tab(page, 'Rutina');
  await expect(timer).toBeVisible();
  await timer.getByRole('button', { name: 'Volver a Hoy' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Sara' })).toBeVisible();

  await page.clock.runFor(166_000);
  await expect(timer).toContainText('Descanso terminado');
  await expect(timer).toContainText('Toca: Sentadilla con barra · serie 2');
  await page.clock.runFor(5_500);
  await expect(timer).toHaveCount(0);
});
