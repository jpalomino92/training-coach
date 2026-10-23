import { expect, test } from '@playwright/test';
import { completeSet, completeWholeDay, createUser, ROUTINE, skipRest } from './helpers';

test('estancamiento y semana de descarga: aviso, plan de reinicio y descarga', async ({ page }) => {
  test.setTimeout(240_000);
  const kg = ['40', '42,5', '45', '45', '45', '45', '45'];
  await page.clock.setFixedTime(new Date('2026-09-07T10:00:00'));
  await createUser(page, 'estancado@correo.com', 'Rosa', ROUTINE.female);
  for (let i = 0; i < kg.length; i++) {
    if (i > 0) {
      await page.clock.setFixedTime(new Date(2026, 8, 7 + i * 7, 10));
      await page.reload();
      await page.getByRole('button', { name: /^F1,/ }).click();
    }
    // Primera serie del hip thrust con el peso de esa semana; el resto se rellena solo
    await completeSet(page, { weight: kg[i], reps: '10', rir: '2' });
    await skipRest(page);
    await completeWholeDay(page, { weight: kg[i], reps: '10', rir: '2' });
  }
  await page.clock.setFixedTime(new Date('2026-10-26T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^F1,/ }).click();

  // Descarga: 7 semanas seguidas entrenando
  const offer = page.getByRole('region', { name: '¿Semana de descarga?' });
  await expect(offer).toContainText('Llevas 7 semanas seguidas entrenando');
  await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/stall-today.png` : undefined, fullPage: false });

  // Estancado: el hip thrust lleva 4 sesiones en 45 kg × 10
  const card = page.getByRole('article', { name: 'Hip thrust con barra' });
  const stall = card.getByRole('group', { name: 'Ejercicio estancado' });
  await expect(stall).toContainText('sin superar 45 kg × 10');
  if (process.env.SHOTS) await card.screenshot({ path: `${process.env.SHOTS}/stall-card.png` });
  await stall.getByRole('button', { name: 'Bajar a 40 kg y volver a subir' }).click();
  await expect(stall).toHaveCount(0);
  await expect(card).toContainText('Reinicio: empieza con 40 kg.');
  await expect(card.getByLabel('Peso kg')).toHaveValue('40');

  // Activar la descarga: cambia la sugerencia del resto de ejercicios
  await offer.getByRole('button', { name: 'Hacer descarga' }).click();
  await expect(page.getByRole('region', { name: 'Semana de descarga' })).toBeVisible();
  await expect(card).toContainText('Semana de descarga: usa unos 40 kg.');
});
