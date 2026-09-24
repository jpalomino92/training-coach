import { expect, test } from './fixtures';
import { completeSet, completeWholeDay, createUser, currentSet, ROUTINE, skipRest, tab } from './helpers';

test('alternativa: máquina ocupada, series aparte y vuelta al ejercicio original', async ({ page }) => {
  await createUser(page, 'alt@correo.com', 'Alba', ROUTINE.male);
  const card = page.getByRole('article', { name: 'Sentadilla con barra' });
  await card.getByRole('button', { name: /Máquina ocupada\? Hacer la alternativa: Sentadilla en Smith o hack/ }).click();

  const alt = page.getByRole('article', { name: 'Sentadilla en Smith o hack' });
  await expect(alt).toContainText('Ejercicio 1 de 7 · alternativa');
  await expect(alt).toContainText('Estás haciendo la alternativa de Sentadilla con barra');
  // Se puede volver antes de registrar
  await alt.getByRole('button', { name: 'Volver a Sentadilla con barra' }).click();
  await expect(page.getByRole('article', { name: 'Sentadilla con barra' })).toBeVisible();
  await page.getByRole('article', { name: 'Sentadilla con barra' }).getByRole('button', { name: /Hacer la alternativa/ }).click();

  await completeSet(page, { weight: '60', reps: '10', rir: '2' });
  await skipRest(page);
  // Con una serie registrada ya no se puede cambiar
  await expect(alt.getByRole('button', { name: /Volver a/ })).toHaveCount(0);
  for (let i = 0; i < 3; i++) { await completeSet(page); await skipRest(page); }
  await expect(alt).toContainText('Ejercicio completado');

  await tab(page, 'Historial');
  await page.getByRole('button', { name: /Pierna A — Cuádriceps/ }).click();
  await expect(page.getByText('Sentadilla en Smith o hack · alternativa')).toBeVisible();
  await tab(page, 'Progreso');
  await expect(page.getByRole('region', { name: 'Sentadilla en Smith o hack' })).toContainText('Alternativa de Sentadilla con barra');
});

test('resumen al terminar: duración, series, volumen y comparación con la sesión anterior', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-14T10:00:00'));
  await createUser(page, 'resumen@correo.com', 'Rosa', ROUTINE.safe, { ack: true });
  await completeWholeDay(page, { weight: '20', reps: '10', rir: '3' });
  const summary = page.getByRole('region', { name: /Entrenamiento completado el 14\/09\/2026/ });
  await expect(summary).toContainText('Series16 de 16');
  await expect(summary).toContainText(/Volumen\d/);

  await page.clock.setFixedTime(new Date('2026-09-21T10:30:00'));
  await page.reload();
  await page.getByRole('button', { name: /^SA,/ }).click();
  await completeSet(page, { weight: '25' }); // más peso que la vez anterior en la prensa
  await skipRest(page);
  await completeWholeDay(page);
  const again = page.getByRole('region', { name: /Entrenamiento completado el 21\/09\/2026/ });
  await expect(again).toContainText('La sesión anterior de este día (14/09/2026): 16 series y 3200 kg');
  await expect(again).toContainText(/volumen \+\d+ %/);
  await expect(again).toContainText('Récord: Prensa de piernas');
});

test('nota del entrenamiento: se guarda sola y se ve en el historial', async ({ page }) => {
  await createUser(page, 'nota@correo.com', 'Nora', ROUTINE.male);
  await expect(page.getByLabel('Nota del entrenamiento')).toHaveCount(0); // aparece al empezar
  await completeSet(page, { weight: '60', reps: '8', rir: '2' });
  await skipRest(page);
  await page.getByLabel('Nota del entrenamiento').fill('Dormí mal, gimnasio lleno');
  await page.getByLabel('Nota del entrenamiento').blur();
  await page.reload();
  await expect(page.getByLabel('Nota del entrenamiento')).toHaveValue('Dormí mal, gimnasio lleno');
  await tab(page, 'Historial');
  await page.getByRole('button', { name: /· Pierna A — Cuádriceps/ }).click();
  await expect(page.getByText('Nota: Dormí mal, gimnasio lleno')).toBeVisible();
});

test('deshacer: serie, entrenamiento y peso corporal borrados se recuperan', async ({ page }) => {
  await createUser(page, 'deshacer@correo.com', 'Dora', ROUTINE.male);
  const card = page.getByRole('article', { name: 'Sentadilla con barra' });
  await completeSet(page, { weight: '80', reps: '8', rir: '2' });
  await skipRest(page);
  await card.getByRole('button', { name: 'Editar serie 1' }).click();
  await page.getByRole('form', { name: 'Editar serie 1' }).getByRole('button', { name: 'Eliminar serie' }).click();
  const toast = page.getByRole('status').filter({ hasText: 'Serie borrada.' });
  await expect(toast).toHaveCount(1);
  await toast.getByRole('button', { name: 'Deshacer' }).click();
  await expect(card.getByText('80 kg × 8, RIR 2')).toBeVisible();

  await tab(page, 'Historial');
  await page.getByRole('button', { name: /· Pierna A — Cuádriceps/ }).click();
  await page.getByRole('button', { name: 'Eliminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByText('Todavía no hay entrenamientos')).toBeVisible();
  await page.getByRole('status').filter({ hasText: 'Entrenamiento eliminado.' }).getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: /· Pierna A — Cuádriceps/ })).toBeVisible();

  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await page.getByRole('button', { name: 'Registrar peso' }).click();
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByLabel('Peso kg').fill('70');
  await page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('button', { name: 'Guardar' }).click();
  await page.getByRole('button', { name: /Editar el registro/ }).click();
  await page.getByRole('dialog', { name: 'Editar peso' }).getByRole('button', { name: 'Eliminar registro' }).click();
  await expect(page.getByText('Aún no has registrado tu peso')).toBeVisible();
  await page.getByRole('status').filter({ hasText: 'Registro eliminado.' }).getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('region', { name: 'Registros' })).toContainText('70 kg');

  // Todo sigue tras recargar
  await page.reload();
  await tab(page, 'Historial');
  await page.getByRole('button', { name: /· Pierna A — Cuádriceps/ }).click();
  await expect(page.getByText('80 kg × 8 · RIR 2')).toBeVisible();
});

test('calculadora de discos en los ejercicios con barra', async ({ page }) => {
  await createUser(page, 'discos@correo.com', 'Pili', ROUTINE.male);
  const form = currentSet(page);
  await form.getByLabel('Peso kg').fill('82,5');
  await expect(form.getByText('Por lado: 25 + 5 + 1,25 (barra de 20 kg).')).toBeVisible();
  await form.getByLabel('Peso kg').fill('15');
  await expect(form.getByText('Menos que la barra sola (20 kg).')).toBeVisible();

  await tab(page, 'Perfil');
  await page.getByRole('group', { name: 'Peso de la barra' }).getByRole('button', { name: '15 kg' }).click();
  await tab(page, 'Hoy');
  await currentSet(page).getByLabel('Peso kg').fill('55');
  await expect(currentSet(page).getByText('Por lado: 20 (barra de 15 kg).')).toBeVisible();

  // Los ejercicios sin barra no la muestran
  await page.getByRole('button', { name: /^4\. Curl femoral tumbado/ }).click();
  await expect(currentSet(page).getByText(/Por lado/)).toHaveCount(0);
});

test('calendario mensual en el historial', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-21T10:00:00'));
  await createUser(page, 'calendario@correo.com', 'Cata', ROUTINE.male);
  await completeSet(page, { weight: '80', reps: '8', rir: '2' });
  await skipRest(page);
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();

  await tab(page, 'Historial');
  const cal = page.getByRole('region', { name: 'Calendario: Septiembre 2026' });
  await expect(cal).toContainText('1 entrenamiento');
  await cal.getByRole('button', { name: 'lunes 21 de septiembre: Pierna A' }).click();
  await expect(page.getByRole('button', { name: /Lun 21\/09 · Pierna A/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(cal.getByRole('button', { name: 'Mes siguiente' })).toHaveAttribute('aria-disabled', 'true');
  await cal.getByRole('button', { name: 'Mes anterior' }).click();
  await expect(page.getByRole('region', { name: 'Calendario: Agosto 2026' })).toContainText('0 entrenamientos');
});
