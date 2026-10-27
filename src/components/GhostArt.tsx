/* Rocky, la mascota que representa tu "yo" de hace un mes: una pose según
   el humor, tamaño según el nivel y transparente cuando está triste.
   Las poses salen de las láminas de design/rocky (aquí, solo las de humor). */
import { GHOST_MAX_LEVEL, MOOD_TEXT, ROCKY, type GhostMood } from '../domain/ghost';
import beaten from '../assets/rocky/beaten.webp';
import face from '../assets/rocky/face.webp';
import rival from '../assets/rocky/rival.webp';
import sad from '../assets/rocky/sad.webp';
import scared from '../assets/rocky/scared.webp';
import smug from '../assets/rocky/smug.webp';

const POSES: Record<GhostMood, string> = { smug, rival, scared, beaten, sad };

const LABEL: Record<GhostMood, string> = {
  smug: 'se ríe y te señala: va ganando',
  rival: 'te mira de brazos cruzados',
  scared: 'está sorprendido',
  beaten: 'está agotado: le ganaste',
  sad: 'está sentado y triste'
};

interface Props {
  mood: GhostMood;
  /** 1–10: cuanto más nivel, más grande. */
  level?: number;
  size?: 'xs' | 'md' | 'lg';
  /** Muestra la frase de Rocky en un globo. */
  speech?: boolean;
}

/** Cara de Rocky en tamaño ícono, junto al texto de cada serie (decorativa). */
export function RockyFace() {
  return <img className="rocky-face" src={face} alt="" aria-hidden="true" draggable={false} />;
}

export function GhostArt({ mood, level = 1, size = 'md', speech }: Props) {
  const scale = 0.78 + (Math.min(level, GHOST_MAX_LEVEL) - 1) * (0.22 / (GHOST_MAX_LEVEL - 1));
  return (
    <span className={`ghost-art ${size}`}>
      <span className="ghost-stage">
        <img className={`ghost-body ${mood}`} src={POSES[mood]} alt={`${ROCKY} ${LABEL[mood]}`} draggable={false}
          style={{ transform: `scale(${scale})`, opacity: mood === 'sad' ? 0.55 : 1 }} />
      </span>
      {speech && <span className="ghost-say">{MOOD_TEXT[mood]}</span>}
    </span>
  );
}
