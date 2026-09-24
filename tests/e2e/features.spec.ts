import { expect, test } from './fixtures';
import { completeSet, createUser, PASSWORD, ROUTINE, signIn, signOut, skipRest, tab } from './helpers';

test('descanso personalizado: el temporizador usa 2 min en básicos y 1 min en accesorios', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-21T10:00:00') });
  await createUser(page, 'descanso@correo.com', 'Dani', ROUTINE.male);
  await completeSet(page, { weight: '80', reps: '8', rir: '2' });
  const timer = page.getByRole('region', { name: 'Temporizador de descanso' });
  await expect(timer.getByRole('timer')).toHaveText('2:30'); // el de la rutina
  await skipRest(page);

  await tab(page, 'Perfil');
  const routine = page.getByRole('switch', { name: 'Usar los descansos de la rutina' });
  await expect(routine).toHaveAttribute('aria-checked', 'true');
  await routine.click();
  await expect(page.getByLabel('Ejercicios básicos: 2:00')).toBeVisible();
  await expect(page.getByLabel('Accesorios: 1:00')).toBeVisible();
  await page.getByRole('button', { name: 'Sumar 15 segundos a ejercicios básicos' }).click();
  await page.getByRole('button', { name: 'Restar 15 segundos a ejercicios básicos' }).click();
  await expect(page.getByLabel('Ejercicios básicos: 2:00')).toBeVisible();
  await page.clock.runFor(1000);

  await tab(page, 'Hoy');
  await expect(page.getByRole('article', { name: 'Sentadilla con barra' }).getByText('Descanso 120 s')).toBeVisible();
  await completeSet(page);
  await expect(timer.getByRole('timer')).toHaveText('2:00');
  await skipRest(page);

  // Se conserva al recargar
  await page.reload();
  await tab(page, 'Perfil');
  await expect(page.getByRole('switch', { name: 'Usar los descansos de la rutina' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('switch', { name: 'Sonido al terminar el descanso' })).toHaveAttribute('aria-checked', 'true');
});

test('importar CSV de peso corporal y de ejercicios, con vista previa y errores por línea', async ({ page }) => {
  await createUser(page, 'csv@correo.com', 'Clara', ROUTINE.male);
  await tab(page, 'Perfil');
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  const sheet = page.getByRole('dialog', { name: 'Importar CSV' });

  // Peso corporal (separador ; y coma decimal, como Excel en español)
  await sheet.getByLabel(/Elige un archivo CSV/).setInputFiles({ name: 'peso.csv', mimeType: 'text/csv', buffer: Buffer.from('fecha;peso_kg;nota\n01/09/2026;78,4;En ayunas\n08/09/2026;77,9;\nayer;70;\n') });
  await expect(sheet.getByRole('status')).toContainText('Se importarán 2 registros');
  await expect(sheet.getByText('Línea 4: Fecha no válida: "ayer". Usa dd/mm/aaaa o aaaa-mm-dd.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Importar 2 registros' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 registros importados' })).toHaveCount(1);

  // Ejercicios
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  await sheet.getByRole('button', { name: 'Ejercicios' }).click();
  await sheet.getByLabel(/Elige un archivo CSV/).setInputFiles({ name: 'series.csv', mimeType: 'text/csv', buffer: Buffer.from(
    'fecha,ejercicio,serie,peso,reps,rir\n01/09/2026,Sentadilla con barra,1,80,8,2\n01/09/2026,Sentadilla con barra,2,80,7,1\n03/09/2026,press banca,1,60,8,2\n03/09/2026,Curl imaginario,1,10,10,2\n') });
  await expect(sheet.getByRole('status')).toContainText('Se importarán 3 registros en 2 entrenamientos');
  await expect(sheet.getByText(/Línea 5: Ejercicio no encontrado en tu rutina: "Curl imaginario"/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Importar 3 registros' }).click();
  await expect(page.getByRole('status').filter({ hasText: '3 registros importados' })).toHaveCount(1);

  await tab(page, 'Historial');
  await page.getByRole('button', { name: /Pierna A — Cuádriceps/ }).click();
  await expect(page.getByText('80 kg × 8 / 7 · RIR 1')).toBeVisible();
  await tab(page, 'Progreso');
  await page.getByRole('button', { name: 'Peso corporal' }).click();
  await expect(page.getByRole('region', { name: 'Registros' })).toContainText('77,9 kg');

  // Reimportar el mismo archivo no duplica
  await tab(page, 'Perfil');
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  await sheet.getByLabel(/Elige un archivo CSV/).setInputFiles({ name: 'peso.csv', mimeType: 'text/csv', buffer: Buffer.from('fecha;peso_kg\n01/09/2026;78,4\n') });
  await expect(sheet.getByRole('status')).toContainText('No hay registros nuevos para importar');
  await expect(sheet.getByText('1 fila ya estaba registrada y se omiten.')).toBeVisible();
});

test('exportar CSV descarga el historial', async ({ page }) => {
  await createUser(page, 'export@correo.com', 'Eva', ROUTINE.male);
  await completeSet(page, { weight: '80', reps: '8', rir: '2' });
  await skipRest(page);
  await tab(page, 'Perfil');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Series (CSV)' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^historial-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = (await (await dl.createReadStream())!.toArray()).join('');
  expect(text).toContain('fecha;ejercicio;serie;peso_kg;reps;rir;rutina;dia');
  expect(text).toContain('Sentadilla con barra;1;80;8;2;Torso / Pierna;Pierna A');
});

test('récord personal al superar la mejor marca y constancia semanal', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-21T10:00:00'));
  await createUser(page, 'record@correo.com', 'Rita', ROUTINE.male);
  await expect(page.getByText('Esta semana: 0 de 4')).toBeVisible();
  await completeSet(page, { weight: '80', reps: '8', rir: '2' });
  await expect(page.getByText(/Nuevo récord/)).toHaveCount(0); // la primera vez no hay récord
  await skipRest(page);
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await expect(page.getByText('Esta semana: 1 de 4')).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-09-23T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^PA,/ }).click();
  await completeSet(page, { weight: '82,5', reps: '8', rir: '2' });
  await expect(page.getByRole('article', { name: 'Sentadilla con barra' }).getByRole('status')).toContainText('Nuevo récord de peso: 82,5 kg');
  await skipRest(page);
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();

  await tab(page, 'Historial');
  await page.getByRole('button', { name: /Mié 23\/09/ }).click();
  await expect(page.getByText('Récord personal')).toBeVisible();

  await tab(page, 'Progreso');
  const cons = page.getByRole('region', { name: 'Constancia' });
  await expect(cons).toContainText('Objetivo: 4 por semana');
  await expect(cons.getByRole('listitem', { name: /Semana del 21\/09: 2 de 4/ })).toBeVisible();
});

test('contraseña: recuperar en modo demo lo explica y cambiarla desde Perfil funciona', async ({ page }) => {
  await createUser(page, 'clave@correo.com', 'Iris', ROUTINE.male);
  await tab(page, 'Perfil');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  const sheet = page.getByRole('dialog', { name: 'Cambiar contraseña' });
  await sheet.getByLabel('Contraseña actual').fill('no-es-la-mia');
  await sheet.getByLabel('Contraseña nueva', { exact: true }).fill('otra-clave-segura');
  await sheet.getByLabel('Repite la contraseña nueva').fill('otra-clave-segura');
  await sheet.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(sheet.getByText('La contraseña actual no es correcta.')).toBeVisible();
  await sheet.getByLabel('Contraseña actual').fill(PASSWORD);
  await sheet.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Contraseña cambiada.' })).toHaveCount(1);

  await signOut(page);
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
  await expect(page.getByText(/no hay forma de recuperar la contraseña/)).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await signIn(page, 'clave@correo.com', PASSWORD);
  await expect(page.getByRole('alert')).toContainText('no son correctos');
  await signIn(page, 'clave@correo.com', 'otra-clave-segura');
  await expect(page.getByRole('heading', { name: 'Hola, Iris' })).toBeVisible();
});
