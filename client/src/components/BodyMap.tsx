import React from "react";
import { BODY_REGIONS, BODY_VIEWBOX, intensityColor, type BodyView } from "@shared/constants";

export type PainMark = { region: string; intensity: number | null };

/** Mappa anatomica interattiva (vista anteriore e posteriore). */
export function BodyMap({ marks, onToggle, selected, compact = false }: { marks: PainMark[]; onToggle?: (regionId: string) => void; selected?: string | null; compact?: boolean }) {
  const byRegion = new Map(marks.map((m) => [m.region, m]));
  const view = (v: BodyView, title: string, leftLabel: string, rightLabel: string) => (
    <figure className="flex flex-col items-center">
      <figcaption className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</figcaption>
      <svg viewBox={BODY_VIEWBOX} className={compact ? "h-56 w-auto" : "h-[420px] w-auto max-w-full"} role="img" aria-label={`Mappa del corpo, ${title}`}>
        <text x="8" y="456" fontSize="10" fill="#94a3b8">{leftLabel}</text>
        <text x="212" y="456" fontSize="10" fill="#94a3b8" textAnchor="end">{rightLabel}</text>
        {BODY_REGIONS.filter((r) => r.view === v).map((r) => {
          const m = byRegion.get(r.id);
          const fill = m ? intensityColor(m.intensity) : "#E7EFEC";
          const common = {
            fill, stroke: selected === r.id ? "#16302D" : "#A7BDB7", strokeWidth: selected === r.id ? 2.5 : 1,
            className: onToggle ? "cursor-pointer transition-opacity hover:opacity-80" : undefined,
            onClick: onToggle ? () => onToggle(r.id) : undefined,
          };
          const shape = r.shape === "ellipse"
            ? <ellipse {...common} cx={r.x + r.w / 2} cy={r.y + r.h / 2} rx={r.w / 2} ry={r.h / 2} />
            : <rect {...common} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} />;
          return <g key={r.id}><title>{r.label}{m?.intensity != null ? ` – ${m.intensity}/10` : ""}</title>{shape}</g>;
        })}
      </svg>
    </figure>
  );
  return (
    <div className="flex flex-wrap items-start justify-center gap-6">
      {view("front", "Anteriore", "DX", "SX")}
      {view("back", "Posteriore", "SX", "DX")}
    </div>
  );
}

export function IntensityLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500">
      <span>0</span>
      <div className="h-2 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 2, 4, 6, 8, 10].map((v) => intensityColor(v)).join(",")})` }} />
      <span>10</span>
    </div>
  );
}
