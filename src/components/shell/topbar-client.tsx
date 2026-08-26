"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function EngagementSelector({
  projects,
}: {
  projects: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Jump to engagement"
      defaultValue=""
      className="input w-auto max-w-[14rem] bg-panel py-1 text-xs"
      onChange={(e) => e.target.value && router.push(`/engagements/${e.target.value}`)}
    >
      <option value="" disabled>
        Engagement…
      </option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.code} — {p.name}
        </option>
      ))}
    </select>
  );
}

/** Grafana-style time range; pages that render time-series read ?range= (dashboard today). */
const RANGES = ["24h", "7d", "30d", "all"] as const;

export function TimeRangeSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "30d";
  return (
    <select
      aria-label="Time range"
      defaultValue={current}
      className="input w-auto bg-panel py-1 text-xs"
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value === "30d") next.delete("range");
        else next.set("range", e.target.value);
        router.push(`${pathname}?${next}`);
      }}
    >
      {RANGES.map((r) => (
        <option key={r} value={r}>
          Last {r}
        </option>
      ))}
    </select>
  );
}
