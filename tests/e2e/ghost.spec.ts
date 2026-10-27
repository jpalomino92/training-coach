import { expect, test } from '@playwright/test';
import { completeSet, completeWholeDay, createUser, ROUTINE, skipRest } from './helpers';

test('fantasma: cada serie se compara con la sesión de hace un mes y el resumen cuenta las victorias', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-14T10:00:00'));
  await createUser(page, 'fantasma@correo.com', 'Rosa', ROUTINE.female);
  await completeWholeDay(page, { weight: '40', reps: '10', rir: '2' });

  await page.clock.setFixedTime(new Date('2026-10-12T10:00:00'));
  await page.reload();
  await page.getByRole('button', { name: /^F1,/ }).click();
  const card = page.getByRole('article', { name: 'Hip thrust con barra' });
  await expect(card).toContainText('Rocky · 14/09/2026: 40 kg × 10 / 40 kg × 10 / 40 kg × 10 / 40 kg × 10');
  await expect(card.getByRole('form', { name: 'Serie 1 de 4' })).toContainText('Rocky: 40 kg × 10. Supéralo.');
  await completeSet(page, { weight: '40', reps: '12' });
  await expect(card).toContainText('Le ganas a Rocky por 2 repeticiones');
  await skipRest(page);
  await completeWholeDay(page, { weight: '40', reps: '10', rir: '2' }, { keepOpen: true });
  await expect(page.getByRole('dialog', { name: 'Entrenamiento completado' })).toContainText('Le ganaste a Rocky en 1 de 5 ejercicios');
});
