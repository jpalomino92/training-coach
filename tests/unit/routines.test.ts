/* El contenido de las rutinas debe coincidir literalmente con el prototipo.
   Solo se permiten el campo nuevo weightStep, el
   renombrado requireAck → requiresHealthNotice y tres poses nuevas. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { PAIN_GUIDE, routinePrograms } from '../../src/domain/routines';
import { POSES } from '../../src/domain/poses';

const legacyPath = ['legacy/js/data/routines.js', 'js/data/routines.js'].map(p => resolve(__dirname, '../..', p)).find(existsSync)!;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLegacy(): any {
  const sandbox = { window: {} as Record<string, unknown> };
  vm.runInNewContext(readFileSync(legacyPath, 'utf8'), sandbox);
  return sandbox.window.RoutineData;
}

const NEW_POSES: Record<string, string> = { pullover_cable: 'pullover', incline_plank: 'inclineplank', pec_deck: 'pecdeck' };
const DUMBBELL = ['rdl_db', 'shoulder_press_db', 'incline_db', 'lateral_raise', 'curl_db', 'hammer_curl', 'one_arm_row', 'reverse_lunge_db', 'farmer_walk'];

describe('rutinas', () => {
  const legacy = loadLegacy();

  it('conserva PAIN_GUIDE literalmente', () => {
    expect(PAIN_GUIDE).toEqual(legacy.PAIN_GUIDE);
  });

  it('conserva los tres programas', () => {
    expect(Object.keys(routinePrograms)).toEqual(['maleUpperLower', 'femaleFatLossMuscle', 'femaleMenopauseSafeStrength']);
  });

  for (const id of Object.keys(legacy.routinePrograms)) {
    it(`${id}: contenido idéntico al prototipo`, () => {
      const old = JSON.parse(JSON.stringify(legacy.routinePrograms[id]));
      const cur = JSON.parse(JSON.stringify(routinePrograms[id]));
      // Cambios permitidos
      old.safety.requiresHealthNotice = old.safety.requireAck; delete old.safety.requireAck;
      for (const d of cur.days) for (const e of d.exercises) {
        delete e.weightStep;
        if (NEW_POSES[e.key]) e.pose = 'OLD';
      }
      for (const d of old.days) for (const e of d.exercises) if (NEW_POSES[e.key]) e.pose = 'OLD';
      expect(cur).toEqual(old);
    });
  }

  it('aviso de salud de la rutina de 56 años: obligatorio y con los textos literales', () => {
    const s = routinePrograms.femaleMenopauseSafeStrength.safety;
    expect(s.requiresHealthNotice).toBe(true);
    expect(s.warnings).toEqual([
      'Debido al antecedente de cirugía de columna y artrosis, esta rutina debe ser revisada por el médico, fisioterapeuta o profesional sanitario que conozca tu historial antes de comenzar.',
      'Si aparece dolor agudo, irradiado, hormigueo, entumecimiento o síntomas neurológicos, detener el ejercicio y consultar a un profesional sanitario.'
    ]);
    expect(s.ackText).toBe('He leído el aviso y revisaré esta rutina con mi médico o fisioterapeuta antes de empezar.');
  });

  it('weightStep: 2,5 por defecto, 1 en mancuernas y 1 en toda la rutina de 56 años', () => {
    for (const p of Object.values(routinePrograms)) for (const d of p.days) for (const e of d.exercises) {
      const expected = p.id === 'femaleMenopauseSafeStrength' || DUMBBELL.includes(e.key) ? 1 : 2.5;
      expect(e.weightStep, `${p.id}/${e.key}`).toBe(expected);
    }
  });


  it('todos los ejercicios tienen una pose existente', () => {
    for (const p of Object.values(routinePrograms)) for (const d of p.days) for (const e of d.exercises) {
      expect(POSES[e.pose], `${e.key} → ${e.pose}`).toBeDefined();
    }
  });

  it('cada día del plan semanal existe', () => {
    for (const p of Object.values(routinePrograms)) for (const [, id] of p.weekPlan) {
      if (id) expect(p.days.some(d => d.id === id)).toBe(true);
    }
  });
});
