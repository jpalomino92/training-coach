/* ==========================================================
   Progression Logic (doble progresión)
   Nunca cambia pesos por sí sola: solo devuelve una sugerencia
   de texto. La persona siempre decide el peso de la sesión.
   ========================================================== */
(function () {
  'use strict';

  function summarize(sets) {
    const s = [...sets].sort((a, b) => a.set_index - b.set_index);
    if (!s.length) return null;
    const weights = s.map(x => Number(x.weight) || 0);
    const rirs = s.map(x => x.rir).filter(x => x !== null && x !== undefined && x !== '');
    return {
      topWeight: Math.max(...weights),
      reps: s.map(x => x.reps),
      finalRir: rirs.length ? Number(rirs[rirs.length - 1]) : null,
      minRir: rirs.length ? Math.min(...rirs.map(Number)) : null,
      count: s.length
    };
  }

  /**
   * @param ex      ejercicio (datos de la rutina)
   * @param sets    series de la última sesión de ese ejercicio
   * @param program programa (usa program.progression)
   * @param feel    'ok' | 'muscle' | 'pain' | undefined
   * @returns {{level:'up'|'hold'|'down'|'pain'|'none', text:string}}
   */
  function suggest(ex, sets, program, feel) {
    const cfg = program.progression || { minRirToProgress: 1, cautious: false };
    if (!sets || !sets.length) return { level: 'none', text: 'Primera vez: elige un peso con el que completes el rango dejando las repeticiones en reserva indicadas.' };
    if (feel === 'pain') return { level: 'pain', text: 'Marcaste dolor articular o de espalda la última vez: no aumentes el peso. Si se repite, detente y consulta con un profesional sanitario.' };

    const sum = summarize(sets);
    const isTime = ex.unit === 's';
    const noLoad = sum.topWeight <= 0;
    const allTop = sets.length >= ex.sets && sets.every(x => Number(x.reps) >= ex.reps.max);
    const anyLow = sets.some(x => Number(x.reps) < ex.reps.min);
    const rirKnown = sum.minRir !== null;
    const rirOk = rirKnown && sum.minRir >= cfg.minRirToProgress;
    const tooHard = cfg.cautious && rirKnown && sum.minRir < 2;

    if (sets.length < ex.sets) return { level: 'hold', text: 'Mantener peso: completa todas las series antes de pensar en subir.' };

    if (allTop && rirOk) {
      if (isTime || noLoad) return { level: 'up', text: cfg.cautious ? 'Podrías intentar una versión un poco más exigente o unos segundos más, siempre sin dolor.' : 'Sugerencia: aumenta un poco la dificultad o el tiempo en la próxima sesión.' };
      return { level: 'up', text: cfg.cautious
        ? `Podrías intentar aumentar ligeramente el peso (${cfg.step}) la próxima sesión, solo si no hubo dolor.`
        : 'Sugerencia: aumentar peso en la próxima sesión.' };
    }
    if (allTop && !rirOk) return { level: 'hold', text: rirKnown
      ? `Mantener peso: llegaste al máximo de repeticiones, pero con RIR por debajo de ${cfg.minRirToProgress}.`
      : 'Mantener peso: anota el RIR para saber si toca subir.' };
    if (anyLow || tooHard) return { level: 'down', text: cfg.cautious
      ? 'Mantener o bajar ligeramente el peso: el objetivo es terminar cada serie con 2–4 repeticiones en reserva.'
      : 'Mantener peso (o bajarlo un poco si no llegas al mínimo del rango).' };
    return { level: 'hold', text: 'Mantener peso e intentar sumar repeticiones hasta llegar al máximo del rango.' };
  }

  window.Progression = { summarize, suggest };
})();
