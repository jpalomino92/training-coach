/* ==========================================================
   Progression Logic (doble progresión)
   Nunca cambia pesos por sí sola: solo devuelve una sugerencia
   de texto. La persona siempre decide el peso de la sesión.
   ========================================================== */
import { fmtNum, kg, round2 } from './format';
import type { Exercise, Feel, Program } from './types';

export type SuggestionLevel = 'none' | 'up' | 'hold' | 'down' | 'pain';

export interface Suggestion {
  level: SuggestionLevel;
  /** Acción, en negrita. */
  action: string;
  /** Motivo, a continuación. */
  reason: string;
  /** Peso de referencia que menciona el texto (solo informativo). */
  weight?: number;
}

export interface SetLike {
  set_index: number;
  weight: number | null;
  reps: number;
  rir: number | null;
}

export interface SessionSummary {
  topWeight: number;
  weights: number[];
  reps: number[];
  finalRir: number | null;
  minRir: number | null;
  count: number;
}

export function summarize(sets: SetLike[]): SessionSummary | null {
  const s = [...sets].sort((a, b) => a.set_index - b.set_index);
  if (!s.length) return null;
  const weights = s.map(x => Number(x.weight) || 0);
  const rirs = s.map(x => x.rir).filter((x): x is number => x !== null && x !== undefined);
  return {
    topWeight: Math.max(...weights),
    weights,
    reps: s.map(x => x.reps),
    finalRir: rirs.length ? Number(rirs[rirs.length - 1]) : null,
    minRir: rirs.length ? Math.min(...rirs.map(Number)) : null,
    count: s.length
  };
}

const DEFAULT_CFG = { minRirToProgress: 1, cautious: false, step: '' };

/**
 * @param ex      ejercicio (datos de la rutina)
 * @param sets    series de la última sesión de ese ejercicio
 * @param program programa (usa program.progression)
 * @param feel    sensación registrada la última vez
 */
export function suggest(ex: Exercise, sets: SetLike[] | null | undefined, program: Pick<Program, 'progression'>, feel?: Feel): Suggestion {
  const cfg = program.progression || DEFAULT_CFG;
  const unitWord = ex.unit === 's' ? 'segundos' : 'repeticiones';

  if (!sets || !sets.length) {
    return {
      level: 'none',
      action: 'Primera vez.',
      reason: ex.unit === 's'
        ? `Elige una versión con la que aguantes ${ex.reps.min}-${ex.reps.max} segundos con buena técnica y sin dolor.`
        : `Elige un peso con el que puedas hacer ${ex.reps.min}-${ex.reps.max} repeticiones y te queden ${ex.rir.split('-')[0]} en reserva.`
    };
  }

  if (feel === 'pain') {
    return {
      level: 'pain',
      action: 'No aumentes el peso.',
      reason: 'Si hoy vuelves a notar dolor, detente y no sigas con este ejercicio. Coméntalo con tu profesional sanitario antes de retomarlo.'
    };
  }

  const sum = summarize(sets)!;
  const step = ex.weightStep;
  const noLoad = ex.unit === 's' || sum.topWeight <= 0;
  const top = sum.topWeight;
  const up = round2(top + step);
  const down = Math.max(0, round2(top - step));
  const repsText = sum.reps.join(' / ');
  const rirKnown = sum.minRir !== null;
  const allTop = sets.length >= ex.sets && sets.every(x => Number(x.reps) >= ex.reps.max);
  const anyLow = sets.some(x => Number(x.reps) < ex.reps.min);
  const failAtMin = sets.find(x => x.rir === 0 && Number(x.reps) <= ex.reps.min);
  const rirOk = rirKnown && sum.minRir! >= cfg.minRirToProgress;
  const tooHard = cfg.cautious && rirKnown && sum.minRir! < 2;
  const hold = noLoad ? 'Mantén la dificultad.' : `Mantén ${kg(top)}.`;

  if (sets.length < ex.sets) {
    return { level: 'hold', action: hold, reason: 'Completa todas las series antes de pensar en subir.', weight: noLoad ? undefined : top };
  }

  if (allTop && rirOk) {
    if (noLoad) {
      return cfg.cautious
        ? { level: 'up', action: 'Podrías intentar una versión un poco más exigente o unos segundos más.', reason: 'Solo si no hubo dolor.' }
        : { level: 'up', action: 'Aumenta un poco la dificultad o el tiempo.', reason: `La última vez hiciste ${repsText} con RIR ${fmtNum(sum.minRir)}.` };
    }
    return cfg.cautious
      ? { level: 'up', action: `Podrías subir a ${kg(up)}, solo si no hubo dolor.`, reason: `Sube solo el incremento mínimo (${fmtNum(step)} kg). La última vez hiciste ${repsText} con RIR ${fmtNum(sum.minRir)}.`, weight: up }
      : { level: 'up', action: `Sube a ${kg(up)}.`, reason: `La última vez hiciste ${repsText} con RIR ${fmtNum(sum.minRir)}.`, weight: up };
  }

  if (allTop && !rirOk) {
    return {
      level: 'hold', action: hold, weight: noLoad ? undefined : top,
      reason: rirKnown
        ? `Llegaste al máximo de ${unitWord}, pero con RIR por debajo de ${cfg.minRirToProgress}.`
        : 'Anota el RIR para saber si toca subir.'
    };
  }

  if (anyLow || failAtMin || tooHard) {
    const why = failAtMin
      ? `La última vez llegaste a RIR 0 con ${failAtMin.reps} ${unitWord}.`
      : anyLow
        ? `La última vez no llegaste al mínimo de ${ex.reps.min} ${unitWord} en alguna serie.`
        : `La última vez terminaste con RIR ${fmtNum(sum.minRir)}.`;
    if (noLoad) {
      return { level: 'down', action: 'Mantén o reduce un poco la dificultad.', reason: `${why} Prioriza la técnica.` };
    }
    return cfg.cautious
      ? { level: 'down', action: `Mantén ${kg(top)} o baja a ${kg(down)}.`, reason: `${why} El objetivo es terminar cada serie con 2–4 repeticiones en reserva.`, weight: down }
      : { level: 'down', action: `Baja a ${kg(down)}.`, reason: `${why} Prioriza la técnica.`, weight: down };
  }

  if (noLoad) {
    return { level: 'hold', action: hold, reason: `Intenta sumar ${unitWord} hasta llegar a ${ex.reps.max} en todas las series.` };
  }
  return {
    level: 'hold', action: hold, weight: top,
    reason: cfg.cautious
      ? `Prioriza un movimiento lento y sin dolor. Cuando hagas ${ex.reps.max} en las ${ex.sets} series con RIR ${cfg.minRirToProgress} o más, podrías subir a ${kg(up)}.`
      : `Cuando hagas ${ex.reps.max} repeticiones en todas las series, sube a ${kg(up)}.`
  };
}
