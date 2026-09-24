/* Capturas de todas las pantallas y estados para compararlas con el PDF de design/.
   npx playwright test --project=visual  →  screenshots/<ancho>-<tema>/NN-nombre.png
   La fecha se fija en el miércoles 23/09/2026, como en el diseño. */
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { completeSet, currentSet, onboard, ROUTINE, signIn, signOut, signUp, skipRest, tab } from './helpers';

const WIDTHS: [string, number, number][] = [['375', 375, 667], ['390', 390, 844], ['430', 430, 932], ['tablet', 820, 1180], ['escritorio', 1280, 900]];
const THEMES = ['light', 'dark'] as const;
const NOW = new Date('2026-09-23T10:00:00');

/** Datos de ejemplo (como en el diseño): 7 semanas de historial, peso corporal y el día 2 a medias. */
async function seedLucia(page: Page) {
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fuerza:v1:session')!);
    const key = 'fuerza:v1:data:' + s.id;
    const d = JSON.parse(localStorage.getItem(key)!);
    const u = s.id;
    const at = (n: number) => { const x = new Date('2026-09-23T10:00:00'); x.setDate(x.getDate() - n); return x.toISOString(); };
    const ymd = (n: number) => { const x = new Date('2026-09-23T10:00:00'); x.setDate(x.getDate() - n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
    d.profile.start_date = '2026-08-04';
    d.profile.age = 34; d.profile.sex = 'Mujer'; d.profile.goal = 'Perder grasa'; d.profile.level = 'Intermedio';
    const plan: Record<string, [string, number, number][]> = {
      F1: [['hip_thrust', 4, 40], ['rdl_db', 3, 14], ['leg_curl_lying', 3, 25], ['kickback_cable', 3, 10], ['abductor_machine', 3, 35], ['dead_bug', 3, 0], ['plank', 3, 0]],
      F2: [['lat_pulldown_neutral', 4, 32.5], ['cable_row', 4, 35], ['chest_supported_row', 3, 12], ['pullover_cable', 3, 15], ['face_pull', 3, 10], ['y_raise', 3, 2], ['curl_db', 3, 6]]
    };
    let n = 0;
    for (let wk = 0; wk < 7; wk++) for (const dayId of ['F1', 'F2']) {
      const ago = 50 - wk * 7 - (dayId === 'F2' ? 0 : 1);
      const id = 'w' + (++n);
      const last = wk === 6;
      d.workouts.push({ id, user_id: u, program_id: 'femaleFatLossMuscle', day_id: dayId, status: 'completed', started_at: at(ago), completed_at: at(ago), feel: last && dayId === 'F2' ? { cable_row: 'pain' } : {}, notes: '' });
      for (const [k, sets, base] of plan[dayId]) {
        const w = base ? base + Math.min(wk, 6) * (base >= 30 ? 1.25 : 0.5) : null;
        for (let i = 0; i < sets; i++) {
          const reps = k === 'plank' ? 40 : k === 'lat_pulldown_neutral' && last ? [12, 11, 10, 10][i] : 12 - (i > 1 ? 1 : 0);
          d.sets.push({ id: `${id}-${k}-${i}`, user_id: u, workout_id: id, exercise_key: k, set_index: i, weight: k === 'lat_pulldown_neutral' && last ? 40 : w, reps, rir: 2, created_at: at(ago), updated_at: at(ago) });
        }
      }
    }
    // Hoy: día 2 en progreso con 2 series del jalón
    d.workouts.push({ id: 'today', user_id: u, program_id: 'femaleFatLossMuscle', day_id: 'F2', status: 'in_progress', started_at: at(0), completed_at: null, feel: {}, notes: '' });
    [[12, 2], [11, 2]].forEach(([reps, rir], i) => d.sets.push({ id: 'today-' + i, user_id: u, workout_id: 'today', exercise_key: 'lat_pulldown_neutral', set_index: i, weight: 40, reps, rir, created_at: at(0), updated_at: at(0) }));
    const weights = [78.4, 78.0, 77.6, 77.5, 76.9, 76.8, 76.2, 76.3, 75.6, 75.4, 75.1, 75.2, 74.6, 74.4, 74.1];
    weights.forEach((kg, i) => d.bodyWeights.push({ id: 'b' + i, user_id: u, date: ymd(50 - Math.round(i * 3.5)), weight_kg: kg, note: i === 14 ? 'En ayunas' : '', created_at: at(0) }));
    d.notes.lat_pulldown_neutral = { user_id: u, exercise_key: 'lat_pulldown_neutral', note: 'Asiento en la posición 4.', updated_at: at(0) };
    localStorage.setItem(key, JSON.stringify(d));
  });
  await page.reload();
}

for (const [label, width, height] of WIDTHS) for (const theme of THEMES) {
  test(`capturas ${label} ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.clock.setFixedTime(NOW);
    let i = 0;
    const shot = async (name: string, opts: { full?: boolean } = {}) => {
      await page.waitForTimeout(80);
      await page.screenshot({ path: `screenshots/${label}-${theme}/${String(++i).padStart(2, '0')}-${name}.png`, fullPage: !!opts.full, animations: 'disabled' });
    };
    const scrollTo = async (loc: ReturnType<Page['locator']>) => { await loc.first().evaluate(el => el.scrollIntoView({ block: 'center' })); };

    // Acceso
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
    await shot('login');
    await signIn(page, 'nadie@correo.com', 'contraseña-mala');
    await expect(page.getByRole('alert')).toBeVisible();
    await shot('login-error');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.getByLabel('Email').fill('lucia@correo');
    await page.getByLabel('Contraseña', { exact: true }).fill('12345678');
    await page.getByLabel('Repite la contraseña').fill('1234');
    await page.getByRole('form', { name: 'Crear cuenta' }).getByRole('button', { name: 'Crear cuenta' }).click();
    await shot('crear-cuenta-errores');

    // Carmen: rutina de 56 años, primera vez
    await signUp(page, 'carmen@correo.com');
    await page.getByLabel('Nombre').fill('Carmen');
    await page.getByLabel('Edad').fill('56');
    await page.getByRole('button', { name: 'Mujer', exact: true }).click();
    await page.getByRole('button', { name: 'Mantenerme activa o activo' }).click();
    await page.getByRole('button', { name: 'Empiezo' }).click();
    await shot('perfil-paso-1', { full: true });
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: ROUTINE.safe }).click();
    await shot('perfil-paso-2-aviso', { full: true });
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.getByRole('heading', { name: 'Hola, Carmen' })).toBeVisible();
    await shot('hoy-aviso-salud-no-iniciado');
    await scrollTo(page.locator('.xcard'));
    await shot('hoy-primera-vez');
    await page.getByRole('complementary', { name: 'Aviso de salud' }).getByRole('button', { name: 'Leer aviso completo' }).click();
    await shot('hoja-aviso-completo');
    await page.keyboard.press('Escape');
    await tab(page, 'Progreso');
    await shot('progreso-vacio');
    await page.getByRole('button', { name: 'Peso corporal' }).click();
    await shot('peso-vacio');
    await tab(page, 'Historial');
    await shot('historial-vacio');
    await signOut(page);

    // Lucía: con historial
    await signUp(page, 'lucia@correo.com');
    await onboard(page, 'Lucía', ROUTINE.female);
    await seedLucia(page);
    await expect(page.getByText('En progreso · 2 de 23 series')).toBeVisible();
    await shot('hoy-en-progreso');
    await scrollTo(page.locator('.set-edit'));
    await shot('hoy-serie-rellenada');
    await currentSet(page).getByLabel('Reps').fill('');
    await currentSet(page).getByRole('button', { name: 'Completar serie' }).click();
    await shot('hoy-serie-error');
    await currentSet(page).getByLabel('Reps').fill('10');
    await currentSet(page).getByRole('button', { name: 'Completar serie' }).click();
    await expect(page.getByRole('region', { name: 'Temporizador de descanso' })).toBeVisible();
    await scrollTo(page.locator('.set-done.fresh'));
    await shot('hoy-serie-registrada-temporizador');
    await page.mouse.wheel(0, 300);
    await shot('hoy-cabecera-compacta');
    await page.getByRole('button', { name: 'Editar serie 1' }).click();
    await scrollTo(page.getByRole('form', { name: 'Editar serie 1' }));
    await shot('hoy-editar-serie');
    await page.getByRole('form', { name: 'Editar serie 1' }).getByRole('button', { name: 'Cancelar' }).click();
    await tab(page, 'Rutina');
    await shot('temporizador-otra-pestana');
    await tab(page, 'Hoy');
    await skipRest(page);
    await completeSet(page, { rir: '1' });
    await skipRest(page);
    await scrollTo(page.locator('.xcard'));
    await shot('hoy-ejercicio-completado');
    const tech = page.getByRole('article', { name: 'Jalón al pecho agarre neutro' }).getByRole('button', { name: 'Técnica, alternativa y notas' });
    await tech.click();
    await scrollTo(page.locator('.acc-body'));
    await shot('hoy-tecnica-y-notas');
    await tech.click();
    await page.getByRole('button', { name: /^Siguiente:/ }).click();
    await scrollTo(page.getByRole('article', { name: 'Remo sentado en polea' }).getByRole('alert'));
    await shot('hoy-alerta-dolor');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /^F1,/ }).click();
    await shot('hoy-otro-dia');

    await tab(page, 'Rutina');
    await shot('rutina');
    await shot('rutina-completa', { full: true });
    await tab(page, 'Progreso');
    await shot('progreso-ejercicios');
    await shot('progreso-ejercicios-completo', { full: true });
    await page.getByRole('button', { name: 'Peso corporal' }).click();
    await shot('peso-corporal');
    await shot('peso-corporal-completo', { full: true });
    await page.getByRole('button', { name: 'Registrar peso' }).click();
    await shot('hoja-registrar-peso');
    await page.getByRole('dialog', { name: 'Registrar peso' }).getByRole('button', { name: 'Cancelar' }).click();
    await tab(page, 'Historial');
    await shot('historial');
    await page.getByRole('button', { name: /Día 1 — Pierna/ }).first().click();
    await shot('historial-abierto');
    await page.getByRole('button', { name: 'Eliminar entrenamiento' }).click();
    await scrollTo(page.getByText('¿Eliminar este entrenamiento?'));
    await shot('historial-confirmar-borrado');
    await tab(page, 'Perfil');
    await shot('perfil');
    await shot('perfil-completo', { full: true });
  });
}
