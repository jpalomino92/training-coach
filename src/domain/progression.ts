/* ==========================================================
   Progression Logic (doble progresión)
   Nunca cambia pesos por sí sola: solo devuelve una sugerencia
   de texto. La persona siempre decide el peso de la sesión.
   ========================================================== */
import { fmtNum, isTimed, loadText, round2, unitSuffix, unitWord as unitWordOf } from './format';
import { secondSetWeight, TECHNIQUES } from './setTechnique';
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
  const unitWord = unitWordOf(ex);
  const kg = (v: number) => loadText(v, ex);

  if (ex.setTechnique && (!sets || !sets.length)) {
    return {
      level: 'none',
      action: 'Primera vez.',
      reason: `Serie 1: elige un peso con el que llegues al fallo entre ${ex.reps.min} y ${ex.reps.max} repeticiones con técnica estricta. Serie 2: baja un 30–40 % y haz ${TECHNIQUES[ex.setTechnique].name}.`
    };
  }

  if (!sets || !sets.length) {
    const range = ex.reps.min === ex.reps.max ? String(ex.reps.min) : `${ex.reps.min}-${ex.reps.max}`;
    const what = ex.load === 'bloques' ? 'los bloques con los que' : 'un peso con el que';
    return {
      level: 'none',
      action: 'Primera vez.',
      reason: ex.unit === 'min'
        ? `Haz ${range} minutos a un ritmo cómodo.`
        : isTimed(ex)
          ? `Elige una versión con la que aguantes ${range} ${unitWord} con buena técnica y sin dolor.`
          : ex.noWeight || !ex.rir
            ? `Haz ${range} repeticiones con buena técnica y sin dolor.`
            : `Elige ${what} puedas hacer ${range} repeticiones y te queden ${ex.rir.split('-')[0]} en reserva.`
    };
  }

  if (feel === 'pain') {
    return {
      level: 'pain',
      action: 'No aumentes el peso.',
      reason: 'Si hoy vuelves a notar dolor, detente y no sigas con este ejercicio. Coméntalo con tu profesional sanitario antes de retomarlo.'
    };
  }

  if (ex.setTechnique) {
    const top = sets.find(x => x.set_index === 0);
    if (top && Number(top.weight) > 0) return twoSetSuggest(ex, top, cfg.cautious, kg);
  }

  const sum = summarize(sets)!;
  const step = ex.weightStep;
  // Los ejercicios por tiempo con peso (sostener mancuernas, pinza con discos) progresan en kilos
  const noLoad = sum.topWeight <= 0;
  const top = sum.topWeight;
  const up = round2(top + step);
  const down = Math.max(0, round2(top - step));
  const repsText = sum.reps.join(' / ');
  const lastText = `${repsText}${unitSuffix(ex)}${sum.minRir !== null ? ` con RIR ${fmtNum(sum.minRir)}` : ''}`;
  const rirKnown = sum.minRir !== null;
  const allTop = sets.length >= ex.sets && sets.every(x => Number(x.reps) >= ex.reps.max);
  const anyLow = sets.some(x => Number(x.reps) < ex.reps.min);
  const failAtMin = sets.find(x => x.rir === 0 && Number(x.reps) <= ex.reps.min);
  // En los ejercicios por tiempo se va al máximo: llegar al tope de segundos basta para progresar (salvo en rutinas prudentes)
  const rirOk = (isTimed(ex) && !cfg.cautious) || (rirKnown && sum.minRir! >= cfg.minRirToProgress);
  const tooHard = cfg.cautious && rirKnown && sum.minRir! < 2;
  const hold = noLoad ? 'Mantén la dificultad.' : `Mantén ${kg(top)}.`;

  if (sets.length < ex.sets) {
    return { level: 'hold', action: hold, reason: 'Completa todas las series antes de pensar en subir.', weight: noLoad ? undefined : top };
  }

  if (allTop && rirOk) {
    if (noLoad) {
      return cfg.cautious
        ? { level: 'up', action: 'Podrías intentar una versión un poco más exigente o unos segundos más.', reason: 'Solo si no hubo dolor.' }
        : { level: 'up', action: 'Aumenta un poco la dificultad o el tiempo.', reason: `La última vez hiciste ${lastText}.` };
    }
    return cfg.cautious
      ? { level: 'up', action: `Podrías subir a ${kg(up)}, solo si no hubo dolor.`, reason: `Sube solo el incremento mínimo (${kg(step)}). La última vez hiciste ${lastText}.`, weight: up }
      : { level: 'up', action: `Sube a ${kg(up)}.`, reason: `La última vez hiciste ${lastText}.`, weight: up };
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
      : `Cuando hagas ${ex.reps.max} ${unitWord} en todas las series, sube a ${kg(up)}.`
  };
}

/**
 * Sistema de 2 series: las dos van al fallo, así que el RIR no decide.
 * Manda la serie 1: se sube cuando supera el máximo del rango con repeticiones limpias.
 */
function twoSetSuggest(ex: Exercise, top: SetLike, cautious: boolean, kg: (v: number) => string): Suggestion {
  const w = Number(top.weight);
  const up = round2(w + ex.weightStep);
  const down = Math.max(0, round2(w - ex.weightStep));
  const second = ` En la serie 2, baja a unos ${kg(secondSetWeight(ex, w))} y haz ${TECHNIQUES[ex.setTechnique!].name}.`;
  const lastText = `La última vez hiciste ${top.reps} repeticiones con ${kg(w)} en la serie 1.`;
  if (top.reps > ex.reps.max) {
    return {
      level: 'up', weight: up,
      action: cautious ? `Podrías subir la serie 1 a ${kg(up)}, solo si no hubo dolor.` : `Sube la serie 1 a ${kg(up)}.`,
      reason: `${lastText} Pasaste el máximo de ${ex.reps.max}: con el peso nuevo empieza cerca de ${ex.reps.min}.${second}`
    };
  }
  if (top.reps < ex.reps.min) {
    return {
      level: 'down', weight: down,
      action: `Baja la serie 1 a ${kg(down)}.`,
      reason: `${lastText} No llegaste a ${ex.reps.min}: con menos peso el músculo hace el trabajo sin balanceo.${second}`
    };
  }
  return {
    level: 'hold', weight: w,
    action: `Mantén ${kg(w)} en la serie 1 e intenta ${top.reps + 1} repeticiones.`,
    reason: `${lastText} Sube de peso cuando pases de ${ex.reps.max} repeticiones limpias.${second}`
  };
}
