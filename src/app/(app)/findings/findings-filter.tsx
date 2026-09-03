"use client";

import { useRouter } from "next/navigation";

const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const STATUSES = ["open", "retest", "fixed", "accepted_risk", "false_positive"];

/**
 * GET filter that navigates softly (router.push) so the page does not do a full
 * reload that jumps the scroll position back to the top.
 */
export function FindingsFilter({
  projects,
  defaults,
}: {
  projects: { id: string; code: string; name: string }[];
  defaults: { q?: string; projectId?: string; severity?: string; status?: string };
}) {
  const router = useRouter();
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const params = new URLSearchParams();
        for (const key of ["q", "projectId", "severity", "status"]) {
          const v = String(fd.get(key) ?? "").trim();
          if (v) params.set(key, v);
        }
        const qs = params.toString();
        router.push(qs ? `/findings?${qs}` : "/findings");
      }}
    >
      <input name="q" placeholder="Search title…" defaultValue={defaults.q ?? ""} className="input max-w-xs" />
      <select name="projectId" defaultValue={defaults.projectId ?? ""} className="input w-auto">
        <option value="">All engagements</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      <select name="severity" defaultValue={defaults.severity ?? ""} className="input w-auto">
        <option value="">All severity</option>
        {SEVERITIES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select name="status" defaultValue={defaults.status ?? ""} className="input w-auto">
        <option value="">All status</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <button className="btn btn-secondary">Filter</button>
    </form>
  );
}
