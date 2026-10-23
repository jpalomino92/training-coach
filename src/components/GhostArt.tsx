/* El fantasma dibujado: cara según el humor, tamaño según el nivel y
   transparente cuando está triste o derrotado. Colores fijos (es un dibujo). */
import { GHOST_MAX_LEVEL, MOOD_TEXT, type GhostMood } from '../domain/ghost';

const INK = '#2B3142';
const BODY = '#F2F4FA';
const EDGE = '#AEB7CB';

const FACES: Record<GhostMood, JSX.Element> = {
  // Sobrado: ojos entrecerrados, sonrisa torcida y mejillas
  smug: <>
    <path d="M40 54q6-5 12 0M66 54q6-5 12 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <path d="M48 70q12 9 26-3" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <ellipse cx="40" cy="64" rx="5" ry="3" fill="#F6B8C4" /><ellipse cx="80" cy="64" rx="5" ry="3" fill="#F6B8C4" />
  </>,
  // Rival: mira de reojo, boca recta
  rival: <>
    <ellipse cx="46" cy="54" rx="6" ry="7.5" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="49" cy="55" r="3.2" fill={INK} />
    <ellipse cx="72" cy="54" rx="6" ry="7.5" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="75" cy="55" r="3.2" fill={INK} />
    <path d="M38 44l12 3M82 44l-12 3" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <path d="M51 71h18" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
  </>,
  // Asustado: ojos grandes, boca en O y una gota de sudor
  scared: <>
    <circle cx="46" cy="53" r="8" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="46" cy="54" r="3" fill={INK} />
    <circle cx="74" cy="53" r="8" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="74" cy="54" r="3" fill={INK} />
    <ellipse cx="60" cy="72" rx="6" ry="7.5" fill={INK} />
    <path d="M88 36q5 8 0 11q-5-3 0-11z" fill="#7FB8E8" />
  </>,
  // Derrotado: ojos en X y boca ondulada
  beaten: <>
    <path d="M41 49l10 10M51 49l-10 10M69 49l10 10M79 49l-10 10" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M47 72q4-4 8 0t8 0t8 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
  </>,
  // Triste: ojos caídos, boca hacia abajo y una lágrima
  sad: <>
    <path d="M40 52q6 5 12 0M68 52q6 5 12 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <path d="M49 74q11-9 22 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <path d="M45 59q3 6 0 8q-3-2 0-8z" fill="#7FB8E8" />
  </>
};

const LABEL: Record<GhostMood, string> = {
  smug: 'sonríe sobrado',
  rival: 'te mira desafiante',
  scared: 'está asustado',
  beaten: 'está derrotado',
  sad: 'está triste'
};

interface Props {
  mood: GhostMood;
  /** 1–10: cuanto más nivel, más grande. */
  level?: number;
  size?: 'xs' | 'md' | 'lg';
  /** Muestra la frase del fantasma en un globo. */
  speech?: boolean;
}

export function GhostArt({ mood, level = 1, size = 'md', speech }: Props) {
  const scale = 0.78 + (Math.min(level, GHOST_MAX_LEVEL) - 1) * (0.22 / (GHOST_MAX_LEVEL - 1));
  const faded = mood === 'sad' || mood === 'beaten';
  return (
    <span className={`ghost-art ${size}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`Tu fantasma ${LABEL[mood]}`}>
        <g className={`ghost-body ${mood}`} style={{ transform: `scale(${scale})`, transformOrigin: '60px 112px', opacity: faded ? 0.5 : 1 }}>
          <ellipse cx="60" cy="114" rx="30" ry="4" fill="#000" opacity=".12" />
          <path d="M22 104V56a38 38 0 0 1 76 0v48l-9.5-7-9.5 7-9.5-7-9.5 7-9.5-7-9.5 7-9.5-7z" fill={BODY} stroke={EDGE} strokeWidth="3" strokeLinejoin="round" />
          {FACES[mood]}
        </g>
      </svg>
      {speech && <span className="ghost-say">{MOOD_TEXT[mood]}</span>}
    </span>
  );
}
