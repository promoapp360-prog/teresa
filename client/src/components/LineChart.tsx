import React from "react";

export type Point = { x: string; y: number; label?: string };

/** Grafico a linea leggero in SVG (andamento VAS, esami del sangue). */
export function LineChart({ points, min = 0, max, height = 180, refMin, refMax, unit = "", color = "#24524C" }:
  { points: Point[]; min?: number; max?: number; height?: number; refMin?: number | null; refMax?: number | null; unit?: string; color?: string }) {
  if (!points.length) return null;
  const W = 600, H = height, P = { l: 36, r: 14, t: 14, b: 30 };
  const ys = points.map((p) => p.y);
  const lo = Math.min(min, ...ys, refMin ?? Infinity);
  const hi = max ?? Math.max(...ys, refMax ?? -Infinity) * 1.1;
  const span = hi - lo || 1;
  const X = (i: number) => P.l + (points.length === 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (points.length - 1));
  const Y = (v: number) => P.t + (1 - (v - lo) / span) * (H - P.t - P.b);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {refMin != null && refMax != null && <rect x={P.l} width={W - P.l - P.r} y={Y(refMax)} height={Math.max(0, Y(refMin) - Y(refMax))} fill="#5E8C7F" opacity={0.12} />}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} stroke="#e2e8f0" />
          <text x={P.l - 6} y={Y(t) + 3} fontSize="10" textAnchor="end" fill="#94a3b8">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
        </g>
      ))}
      <polyline fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" points={points.map((p, i) => `${X(i)},${Y(p.y)}`).join(" ")} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(p.y)} r={4.5} fill="#fff" stroke={color} strokeWidth={2.5}><title>{`${p.label || p.x}: ${p.y}${unit}`}</title></circle>
          <text x={X(i)} y={Y(p.y) - 9} fontSize="11" textAnchor="middle" fill="#16302D" fontWeight={700}>{p.y}</text>
          {(points.length <= 12 || i % Math.ceil(points.length / 12) === 0) && <text x={X(i)} y={H - 10} fontSize="10" textAnchor="middle" fill="#64748b">{p.x}</text>}
        </g>
      ))}
    </svg>
  );
}

export function Bars({ rows, format = (n: number) => String(n) }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="text-sm">
          <div className="flex justify-between gap-3"><span className="truncate">{r.label}</span><span className="font-bold">{format(r.value)}</span></div>
          <div className="mt-1 h-2 rounded-full bg-brand-mist"><div className="h-2 rounded-full bg-brand-sage" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
