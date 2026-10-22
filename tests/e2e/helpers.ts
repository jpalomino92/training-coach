/* Utilidades de las pruebas de extremo a extremo: solo roles y textos visibles. */
import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'contraseña-larga-123';

export const ROUTINE = {
  male: /Torso \/ Pierna/,
  female: /Recomposición/,
  safe: /Rutina del especialista/
};

export async function signUp(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Repite la contraseña').fill(PASSWORD);
  await page.getByRole('form', { name: 'Crear cuenta' }).getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible();
}

export async function onboard(page: Page, name: string, routine: RegExp, opts: { ack?: boolean } = {}) {
  await page.getByLabel('Nombre').fill(name);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: routine }).click();
  if (opts.ack) await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();
}

export async function createUser(page: Page, email: string, name: string, routine: RegExp, opts: { ack?: boolean } = {}) {
  await signUp(page, email);
  await onboard(page, name, routine, opts);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
}

export const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Secciones' }).getByRole('button', { name, exact: true }).click();

/** Formulario de la serie que toca ahora. */
export const currentSet = (page: Page) => page.getByRole('form', { name: /^Serie \d+ de \d+$/ });

/** Rellena la serie activa (solo los valores indicados) y pulsa Completar. */
export async function completeSet(page: Page, v: { weight?: string; reps?: string; rir?: string } = {}) {
  const form = currentSet(page);
  await expect(form).toBeVisible();
  // Los ejercicios sin carga (movilidad, cardio) no piden el peso; las máquinas de placas, en bloques
  const weight = form.getByLabel(/^(Peso kg|Bloques)$/);
  if (v.weight != null && await weight.count()) await weight.fill(v.weight);
  if (v.reps != null) await form.getByLabel(/^(Reps|Seg|Min)$/).fill(v.reps);
  const rir = form.getByLabel('RIR', { exact: true });
  if (v.rir != null && await rir.count()) await rir.fill(v.rir);
  await form.getByRole('button', { name: 'Completar serie' }).click();
}

/** Cierra la ventana de entrenamiento completado si está abierta. */
export async function closeDone(page: Page) {
  const done = page.getByRole('dialog', { name: 'Entrenamiento completado' });
  if (await done.isVisible()) await done.getByRole('button', { name: 'Listo' }).click();
}

/** Confirma "Terminar" con series pendientes y cierra la ventana de resumen. */
export async function finishWorkout(page: Page) {
  await page.getByRole('button', { name: 'Terminar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Entrenamiento completado' })).toBeVisible();
  await closeDone(page);
}

/** Cierra el temporizador de descanso si está abierto. */
export async function skipRest(page: Page) {
  const timer = page.getByRole('region', { name: 'Temporizador de descanso' });
  if (await timer.isVisible()) await timer.getByRole('button', { name: /Saltar|Cerrar/ }).click();
}

/** Completa todas las series del día elegido (rellena reps y RIR si vienen vacíos). */
export async function completeWholeDay(page: Page, v = { weight: '20', reps: '10', rir: '2' }, opts: { keepOpen?: boolean } = {}) {
  for (let guard = 0; guard < 120; guard++) {
    const form = currentSet(page);
    if (await form.count()) {
      const reps = form.getByLabel(/^(Reps|Seg|Min)$/);
      const empty = (await reps.inputValue()) === '';
      await completeSet(page, empty ? v : {});
      await skipRest(page);
      continue;
    }
    const next = page.getByRole('button', { name: /^Siguiente:/ });
    if (await next.count()) { await next.click(); continue; }
    // Cardio final: un tramo y terminar
    const cardio = page.getByRole('form', { name: 'Añadir cardio' });
    if (await cardio.count()) {
      await cardio.getByLabel('Min').fill('10');
      await cardio.getByRole('button', { name: /^Añadir/ }).click();
      await page.getByRole('article', { name: 'Cardio final' }).getByRole('button', { name: 'Terminar entrenamiento' }).click();
      continue;
    }
    if (!opts.keepOpen) await closeDone(page);
    return;
  }
  throw new Error('No se pudo completar el día');
}
