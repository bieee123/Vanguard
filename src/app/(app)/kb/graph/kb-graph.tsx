"use client";

import { useState } from "react";
import Link from "next/link";

export interface GraphNode {
  id: string;
  title: string;
  type: "note";
}
export interface GraphEdge {
  source: string;
  target: string;
  broken: boolean;
}

// ponytail: deterministic circular layout with neighbor highlight — a force simulation
// (d3-force) only if the vault grows past a few hundred notes
export function KbGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const [active, setActive] = useState<string | null>(null);
  const R = Math.min(320, 90 + nodes.length * 8);

  const pos = new Map(
    nodes.map((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      return [n.id, { x: 340 + R * Math.cos(angle), y: 260 + R * Math.sin(angle) }];
    })
  );

  const neighbors = new Set<string>();
  if (active) {
    neighbors.add(active);
    for (const e of edges) {
      if (e.source === active) neighbors.add(e.target);
      if (e.target === active) neighbors.add(e.source);
    }
  }

  return (
    <div>
      <svg viewBox="0 0 680 520" className="w-full rounded-md border border-line-subtle bg-panel">
        {edges.map((e, i) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          const dim = active && !(neighbors.has(e.source) && neighbors.has(e.target));
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={e.broken ? "#E5484D" : "#303A46"}
              strokeWidth={1}
              opacity={dim ? 0.15 : 0.9}
            />
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const dim = active !== null && !neighbors.has(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={dim ? 0.25 : 1}
              onMouseEnter={() => setActive(n.id)}
              onMouseLeave={() => setActive(null)}
              className="cursor-pointer"
            >
              <circle r={9} fill={n.id === active ? "#E5484D" : "#181D24"} stroke="#3D4856" />
              <text textAnchor="middle" dy={22} fontSize={9} fill="#9AA4B2">
                {n.title.length > 18 ? `${n.title.slice(0, 17)}…` : n.title}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="text-fg-muted">Nodes:</span>
        {nodes.slice(0, 40).map((n) => (
          <Link
            key={n.id}
            href={`/kb/${n.id}`}
            onMouseEnter={() => setActive(n.id)}
            onMouseLeave={() => setActive(null)}
            className="rounded-sm border border-line-subtle px-1.5 py-0.5 hover:border-blue hover:text-blue"
          >
            {n.title}
          </Link>
        ))}
        {nodes.length > 40 && <span className="text-fg-muted">+{nodes.length - 40} more</span>}
      </div>
    </div>
  );
}
