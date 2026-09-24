/* Gráficos de una sola serie (color --day-text, línea de 2 px, sin ejes en el
   de ejercicio). Al tocar o pasar el cursor aparece la etiqueta del punto. */
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react';

export function useWidth<T extends HTMLElement>(fallback = 300) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(120, Math.round(el.getBoundingClientRect().width) || fallback));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

export interface Point { x: number; y: number; label: string }

const nearest = (xs: number[], px: number) => xs.reduce((best, x, i) => (Math.abs(x - px) < Math.abs(xs[best] - px) ? i : best), 0);

/** Tarjeta de progreso: 64 px, punto final de 9 px con aro --surface. */
export function Sparkline({ points, summary }: { points: Point[]; summary: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState<number | null>(null);
  const H = 64, pad = 6;
  const ys = points.map(p => p.y);
  const mn = Math.min(...ys), mx = Math.max(...ys), r = mx - mn || 1;
  const X = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const Y = (v: number) => H - pad - ((v - mn) / r) * (H - pad * 2);
  const xs = points.map((_, i) => X(i));
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setSel(nearest(xs, e.clientX - box.left));
  };
  const last = points.length - 1;
  return (
    <div className="spark-wrap" ref={ref}>
      <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}
        onPointerMove={move} onPointerDown={move} onPointerLeave={() => setSel(null)}>
        <line x1={0} x2={W} y1={H - 1} y2={H - 1} stroke="var(--line)" strokeWidth={1} />
        <polyline points={points.map((p, i) => `${X(i)},${Y(p.y)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {sel != null && sel !== last && <circle cx={X(sel)} cy={Y(points[sel].y)} r={4.5} fill="currentColor" stroke="var(--surface)" strokeWidth={2} />}
        <circle cx={X(last)} cy={Y(points[last].y)} r={4.5} fill="currentColor" stroke="var(--surface)" strokeWidth={2} />
      </svg>
      {sel != null && (
        <span className="tip" style={{ left: Math.min(W - 60, Math.max(60, X(sel))), top: Y(points[sel].y) - 10 }} aria-hidden="true">{points[sel].label}</span>
      )}
    </div>
  );
}

/** Peso corporal: 326 × 190 de referencia, 3 líneas de guía, un punto por registro. */
export function WeightChart({ points, xLabels, summary, fmtY }: { points: Point[]; xLabels: { x: number; label: string }[]; summary: string; fmtY(v: number): string }) {
  const [ref, W] = useWidth<HTMLDivElement>(326);
  const [sel, setSel] = useState<number | null>(null);
  const H = 190, left = 30, right = 30, top = 14, bottom = 26;
  const ys = points.map(p => p.y);
  let mn = Math.floor(Math.min(...ys)), mx = Math.ceil(Math.max(...ys));
  if (mx - mn < 2) { mn -= 1; mx += 1; }
  const guides = [mn, (mn + mx) / 2, mx];
  const x0 = Math.min(...points.map(p => p.x)), x1 = Math.max(...points.map(p => p.x));
  const X = (x: number) => left + (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0)) * (W - left - right);
  const Y = (v: number) => top + (1 - (v - mn) / (mx - mn)) * (H - top - bottom);
  const xs = points.map(p => X(p.x));
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setSel(nearest(xs, e.clientX - box.left));
  };
  const last = points.length - 1;
  return (
    <div className="plot" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}
        onPointerMove={move} onPointerDown={move} onPointerLeave={() => setSel(null)} style={{ color: 'var(--day-text)' }}>
        {guides.map(g => (
          <g key={g}>
            <line x1={left} x2={W - right + 10} y1={Y(g)} y2={Y(g)} stroke="var(--line)" strokeWidth={1} />
            <text x={left - 6} y={Y(g) + 4} textAnchor="end">{fmtY(g)}</text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={l.label} x={X(l.x)} y={H - 6} textAnchor={xLabels.length > 1 && i === xLabels.length - 1 ? 'end' : xLabels.length > 1 && i === 0 ? 'start' : 'middle'}>{l.label}</text>
        ))}
        {sel != null && <line x1={X(points[sel].x)} x2={X(points[sel].x)} y1={top - 6} y2={H - bottom} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 4" />}
        <polyline points={points.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={i === last ? 6 : 4} fill="currentColor"
            stroke={i === sel ? 'var(--accent)' : 'var(--surface)'} strokeWidth={i === sel ? 3 : 2} />
        ))}
        <text x={X(points[last].x) + 10} y={Y(points[last].y) + (Y(points[last].y) > H - bottom - 20 ? -12 : 20)} textAnchor="end" style={{ fill: 'var(--ink)', fontWeight: 700 }}>{fmtY(points[last].y)}</text>
      </svg>
      {sel != null && (
        <span className="tip" style={{ left: Math.min(W - 70, Math.max(70, X(points[sel].x))), top: Y(points[sel].y) - 12 }} aria-hidden="true">{points[sel].label}</span>
      )}
    </div>
  );
}
