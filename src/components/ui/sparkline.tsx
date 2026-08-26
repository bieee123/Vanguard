/** Tiny sub-toned SVG line for stat panels (design-system §5). No axes, no interaction. */
export function Sparkline({
  points,
  color = "#9AA4B2",
  height = 26,
}: {
  points: number[];
  color?: string;
  height?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(100 - (p / max) * 92 - 4).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height }} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" opacity={0.55} />
    </svg>
  );
}

/** Trend delta chip: compares last value vs previous window mean. */
export function TrendDelta({ series }: { series: number[] }) {
  if (series.length < 4) return null;
  const half = Math.floor(series.length / 2);
  const prev = series.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const curr = series.slice(half).reduce((a, b) => a + b, 0) / (series.length - half);
  if (prev === 0 && curr === 0) return null;
  const delta = prev === 0 ? 100 : Math.round(((curr - prev) / prev) * 100);
  const up = delta > 0;
  const cls = delta === 0 ? "text-fg-muted" : up ? "text-signal" : "text-teal";
  return (
    <span className={`text-[11px] font-medium ${cls}`}>
      {delta === 0 ? "—" : up ? `▲ ${delta}%` : `▼ ${Math.abs(delta)}%`}{" "}
      <span className="font-normal text-fg-muted">vs prev.</span>
    </span>
  );
}
