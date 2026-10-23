import { expect, test } from '@playwright/test';
import { completeSet, createUser, finishWorkout, ROUTINE, skipRest } from './helpers';

test('calentamiento: escalera hasta el peso de la serie 1 y desaparece al empezar', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-14T10:00:00'));
  await createUser(page, 'calentar@correo.com', 'Juan', ROUTINE.male);
  const card = page.getByRole('article', { name: 'Sentadilla con barra' });
  await expect(card).toContainText('Calentamiento: cuando elijas el peso de la serie 1');
  await completeSet(page, { weight: '100', reps: '8', rir: '2' });
  await expect(card.locator('.warmup')).toHaveCount(0);
  await skipRest(page);
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await finishWorkout(page);

  // La semana siguiente ya hay peso de trabajo: escalera con discos por lado
  await page.clock.setFixedTime(new Date('2026-09-21T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^PA,/ }).click();
  const warm = page.getByRole('article', { name: 'Sentadilla con barra' }).locator('.warmup');
  await expect(warm).toContainText('Calentamiento · 4 series hasta 100 kg');
  await expect(warm).toContainText('Barra sola × 10');
  await expect(warm).toContainText('70 kg × 3 · Por lado: 25');
  if (process.env.SHOTS) await warm.screenshot({ path: `${process.env.SHOTS}/warmup.png` });
});
