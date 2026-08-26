"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

export function CoverageLine({ points }: { points: { day: string; pct: number }[] }) {
  if (points.length === 0) return <p className="text-sm text-fg-muted">No detection history yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke="#27303A" strokeDasharray="0" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: "#66707E", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#303A46" }} />
        <YAxis domain={[0, 100]} tick={{ fill: "#66707E", fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: "#181D24", border: "1px solid #303A46", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "#E6EAF0" }}
          itemStyle={{ color: "#35B7A0" }}
        />
        {/* target line: 80% coverage goal */}
        <ReferenceLine y={80} stroke="#5B8DEF" strokeDasharray="4 4" />
        <Line type="stepAfter" dataKey="pct" stroke="#35B7A0" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
