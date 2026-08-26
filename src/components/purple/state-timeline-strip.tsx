/**
 * Horizontal state-timeline strip (design §6.6) — pure SVG, read-only.
 * One lane per technique; segment color = verdict of that entry.
 */
const VERDICT_FILL: Record<string, string> = {
  detected: "#35B7A0",
  not_detected: "#E5484D",
  partial: "#D9A441",
  detected_late: "#D9A441",
  untested: "#3D4856",
};

export interface StripEntry {
  id: string;
  techniqueId: string;
  timestamp: Date;
  verdict: string | null;
}

export function StateTimelineStrip({ entries }: { entries: StripEntry[] }) {
  if (entries.length === 0) return null;

  const times = entries.map((e) => e.timestamp.getTime());
  const min = Math.min(...times);
  const max = Math.max(...times);
  const span = Math.max(max - min, 1);

  const lanes = new Map<string, StripEntry[]>();
  for (const e of entries.slice().sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    (lanes.get(e.techniqueId) ?? lanes.set(e.techniqueId, []).get(e.techniqueId)!).push(e);
  }

  const laneH = 22;
  const width = 900;
  const height = lanes.size * laneH + 26;
  const x = (t: number) => 110 + ((t - min) / span) * (width - 130);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="State timeline">
      {/* axis */}
      <line x1={110} y1={height - 14} x2={width - 10} y2={height - 14} stroke="#303A46" />
      <text x={110} y={height - 2} fontSize={9} fill="#66707E">
        {new Date(min).toISOString().slice(5, 16).replace("T", " ")}
      </text>
      <text x={width - 10} y={height - 2} fontSize={9} fill="#66707E" textAnchor="end">
        {new Date(max).toISOString().slice(5, 16).replace("T", " ")}
      </text>

      {[...lanes.entries()].map(([technique, list], i) => {
        const y = i * laneH + 8;
        return (
          <g key={technique}>
            <text x={100} y={y + 12} fontSize={10} fill="#8B7FE8" textAnchor="end" fontFamily="monospace">
              {technique}
            </text>
            {list.map((e, j) => {
              const nextT = list[j + 1]?.timestamp.getTime() ?? max;
              const x1 = x(e.timestamp.getTime());
              const x2 = Math.max(x(nextT), x1 + 3);
              return (
                <rect
                  key={e.id}
                  x={x1}
                  y={y}
                  width={Math.min(x2 - x1, 26)}
                  height={12}
                  rx={2}
                  fill={VERDICT_FILL[e.verdict ?? "untested"]}
                  opacity={j === list.length - 1 ? 1 : 0.45}
                >
                  <title>{`${technique} · ${e.verdict ?? "untested"} · ${e.timestamp.toISOString().slice(5, 16).replace("T", " ")}`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
