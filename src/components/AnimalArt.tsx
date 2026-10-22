/* Ilustraciones planas de los animales del resumen ("Levantaste 2 morsas").
   Colores fijos: son dibujos, se ven igual en tema claro y oscuro. */
import type { ReactNode } from 'react';
import type { Animal } from '../domain/animals';

const EYE = '#2B2B2B';
const leg = (x: number, color: string, w = 8, y = 104, h = 16) => <rect key={x} x={x} y={y} width={w} height={h} rx={w / 2} fill={color} />;

const ART: Record<Animal['id'], { bg: string; body: ReactNode }> = {
  gato: { bg: '#FCE7CF', body: <>
    <path d="M140 100 q30 -10 18 -40" stroke="#C9792E" strokeWidth="7" fill="none" strokeLinecap="round" />
    {[84, 96, 118, 130].map(x => leg(x, '#C9792E'))}
    <ellipse cx="110" cy="100" rx="34" ry="20" fill="#E8A04C" />
    <polygon points="62,70 64,48 78,62" fill="#C9792E" /><polygon points="80,62 94,48 94,70" fill="#C9792E" />
    <circle cx="78" cy="78" r="18" fill="#E8A04C" />
    <circle cx="72" cy="76" r="2.2" fill={EYE} /><circle cx="85" cy="76" r="2.2" fill={EYE} />
    <polygon points="76,83 81,83 78.5,86" fill="#B4553A" />
  </> },
  perro: { bg: '#F3E3D3', body: <>
    <path d="M144 90 q16 -6 12 -26" stroke="#7A4B25" strokeWidth="6" fill="none" strokeLinecap="round" />
    {[84, 96, 120, 132].map(x => leg(x, '#7A4B25', 9))}
    <ellipse cx="110" cy="96" rx="38" ry="18" fill="#B5793F" />
    <circle cx="72" cy="74" r="17" fill="#B5793F" />
    <ellipse cx="57" cy="81" rx="11" ry="7" fill="#D7A274" />
    <circle cx="47" cy="79" r="3.5" fill={EYE} />
    <ellipse cx="80" cy="74" rx="6" ry="13" fill="#7A4B25" />
    <circle cx="66" cy="70" r="2.2" fill={EYE} />
  </> },
  oveja: { bg: '#DCEFD6', body: <>
    {[88, 100, 120, 132].map(x => leg(x, '#3A3A3A', 6))}
    {[[96, 88], [112, 82], [128, 88], [104, 100], [122, 100], [138, 96], [90, 100]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="15" fill="#F7F4EC" />)}
    <ellipse cx="72" cy="86" rx="12" ry="15" fill="#3A3A3A" />
    <ellipse cx="60" cy="80" rx="7" ry="3.5" fill="#3A3A3A" /><ellipse cx="84" cy="80" rx="7" ry="3.5" fill="#3A3A3A" />
    <circle cx="76" cy="72" r="9" fill="#F7F4EC" />
    <circle cx="67" cy="84" r="2" fill="#fff" /><circle cx="77" cy="84" r="2" fill="#fff" />
  </> },
  leon: { bg: '#FBEBC4', body: <>
    <path d="M148 98 q18 -4 16 -24" stroke="#C88F35" strokeWidth="5" fill="none" strokeLinecap="round" />
    <circle cx="164" cy="72" r="6" fill="#A8642A" />
    {[90, 102, 124, 136].map(x => leg(x, '#C88F35', 9))}
    <ellipse cx="116" cy="96" rx="38" ry="18" fill="#D9A441" />
    <circle cx="74" cy="78" r="26" fill="#A8642A" />
    <circle cx="74" cy="80" r="16" fill="#E2B357" />
    <circle cx="68" cy="77" r="2.2" fill={EYE} /><circle cx="80" cy="77" r="2.2" fill={EYE} />
    <ellipse cx="74" cy="86" rx="4" ry="3" fill="#6E3B1E" />
  </> },
  oso: { bg: '#E9DDD2', body: <>
    {[82, 98, 122, 138].map(x => leg(x, '#5E361F', 13, 100, 20))}
    <ellipse cx="112" cy="92" rx="44" ry="26" fill="#7B4A2D" />
    <circle cx="56" cy="60" r="8" fill="#7B4A2D" /><circle cx="80" cy="60" r="8" fill="#7B4A2D" />
    <circle cx="68" cy="78" r="21" fill="#7B4A2D" />
    <ellipse cx="62" cy="87" rx="10" ry="8" fill="#A8744F" />
    <ellipse cx="59" cy="84" rx="4" ry="3" fill={EYE} />
    <circle cx="64" cy="73" r="2.4" fill={EYE} /><circle cx="76" cy="73" r="2.4" fill={EYE} />
  </> },
  morsa: { bg: '#D6E7F7', body: <>
    <polygon points="120,40 170,118 70,118" fill="#B9D4EE" />
    <path d="M64 118 C56 64 92 46 112 70 C128 90 168 92 168 118 Z" fill="#8B5A35" />
    <path d="M138 118 q10 -14 26 -4 l2 4 Z" fill="#A9714A" />
    <circle cx="88" cy="66" r="22" fill="#8B5A35" />
    <rect x="80" y="84" width="4" height="22" rx="2" fill="#EAD9B0" /><rect x="90" y="84" width="4" height="22" rx="2" fill="#EAD9B0" />
    <ellipse cx="81" cy="80" rx="9" ry="7" fill="#A9714A" /><ellipse cx="94" cy="80" rx="9" ry="7" fill="#A9714A" />
    <circle cx="80" cy="62" r="2.2" fill={EYE} /><circle cx="96" cy="62" r="2.2" fill={EYE} />
  </> },
  rinoceronte: { bg: '#E6E2D8', body: <>
    {[84, 100, 124, 140].map(x => leg(x, '#6E767A', 13, 100, 20))}
    <ellipse cx="114" cy="92" rx="44" ry="24" fill="#8D9599" />
    <path d="M82 76 L48 88 L50 104 L84 106 Z" fill="#8D9599" />
    <polygon points="50,90 44,66 60,88" fill="#E3DDCF" /><polygon points="64,84 62,72 70,84" fill="#E3DDCF" />
    <polygon points="80,74 84,62 88,76" fill="#6E767A" />
    <circle cx="72" cy="86" r="2.2" fill={EYE} />
  </> },
  elefante: { bg: '#E2E7EE', body: <>
    <path d="M158 88 q8 8 4 20" stroke="#7D8792" strokeWidth="4" fill="none" strokeLinecap="round" />
    {[90, 106, 130, 146].map(x => leg(x, '#7D8792', 14, 100, 20))}
    <ellipse cx="120" cy="86" rx="42" ry="28" fill="#9AA3AD" />
    <path d="M60 82 q-8 22 4 34" stroke="#9AA3AD" strokeWidth="11" fill="none" strokeLinecap="round" />
    <circle cx="74" cy="74" r="22" fill="#9AA3AD" />
    <ellipse cx="90" cy="76" rx="14" ry="21" fill="#7D8792" />
    <path d="M64 92 q-2 8 -10 8" stroke="#F1EBDD" strokeWidth="4" fill="none" strokeLinecap="round" />
    <circle cx="68" cy="70" r="2.4" fill={EYE} />
  </> },
  ballena: { bg: '#D3E6F6', body: <>
    <path d="M70 58 q-6 -12 -2 -22 M70 58 q6 -12 14 -18" stroke="#8FBCE3" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M36 92 C36 66 110 60 150 84 L178 66 L170 92 L180 112 L150 100 C120 118 44 120 36 92 Z" fill="#4C7FB5" />
    <path d="M44 100 C70 114 112 112 140 102 C112 108 70 108 44 100 Z" fill="#CFE0F0" />
    <path d="M92 104 q8 14 22 12 q-6 -8 -10 -12 Z" fill="#3D6A99" />
    <circle cx="60" cy="88" r="2.6" fill={EYE} />
  </> }
};

export function AnimalArt({ id }: { id: Animal['id'] }) {
  const a = ART[id];
  return (
    <svg className="animal-art" viewBox="0 0 200 136" aria-hidden="true" focusable="false">
      <circle cx="104" cy="76" r="56" fill={a.bg} />
      {a.body}
    </svg>
  );
}
