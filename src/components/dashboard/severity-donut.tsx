"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { SEVERITY_HEX } from "./severity-colors";

export function SeverityDonut({ data }: { data: { severity: string; count: number }[] }) {
  const chartData = data.filter((d) => d.count > 0);
  if (chartData.length === 0) return <p className="text-sm text-fg-muted">No findings yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={chartData} dataKey="count" nameKey="severity" innerRadius={45} outerRadius={65} paddingAngle={2} stroke="none">
          {chartData.map((d) => (
            <Cell key={d.severity} fill={SEVERITY_HEX[d.severity] ?? "#667085"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#181D24", border: "1px solid #303A46", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "#E6EAF0" }}
          itemStyle={{ color: "#9AA4B2" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
