/* Ilustración del ejercicio: figura SVG de poses en un cuadrado con el tinte del día.
   Tamaños del HANDOFF: lg 88 px / r18 (tarjeta activa), sm 52 px / r12 (filas),
   md 48 px (tarjeta de progreso), xs 36 px / r8 (listas).
   `imageSrc` queda preparado para un archivo de imagen propio por ejercicio;
   hoy no hay ninguna fuente de imágenes y siempre se usa la figura. */
import { getPose } from '../domain/poses';

type Size = 'lg' | 'sm' | 'md' | 'xs';

interface Props {
  pose: string;
  size?: Size;
  imageSrc?: string;
  plain?: boolean;
}

export function PoseSvg({ pose }: { pose: string }) {
  const d = getPose(pose);
  const pts = (a: number[]) => a.join(' ');
  return (
    <svg className="pose" viewBox="0 0 160 110" aria-hidden="true" focusable="false" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {(d.p || []).map((a, i) => <polyline key={`p${i}`} className="prop" points={pts(a)} strokeWidth={4} />)}
      {(d.r || []).map((r, i) => <rect key={`r${i}`} className="box" x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={3} />)}
      {(d.w || []).map((c, i) => (
        <g key={`w${i}`}>
          <circle className="wt" cx={c[0]} cy={c[1]} r={c[2]} />
          <circle className="wt-hole" cx={c[0]} cy={c[1]} r={Math.max(1.5, c[2] / 4)} />
        </g>
      ))}
      {d.l.map((a, i) => <polyline key={`l${i}`} className="limb" points={pts(a)} strokeWidth={8} />)}
      <circle className="head" cx={d.h[0]} cy={d.h[1]} r={10} />
    </svg>
  );
}

export function ExerciseIllustration({ pose, size = 'lg', imageSrc, plain }: Props) {
  const cls = ['ill', size === 'lg' ? '' : size, imageSrc ? 'gif' : '', plain ? 'plain' : ''].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {imageSrc
        ? <img src={imageSrc} alt="" loading={size === 'lg' ? 'eager' : 'lazy'} decoding="async" />
        : <PoseSvg pose={pose} />}
    </span>
  );
}
