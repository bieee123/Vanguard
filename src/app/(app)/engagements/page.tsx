import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { PhaseRail } from "@/components/ui/phase-rail";

export default async function EngagementsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      application: true,
      findings: { select: { severity: true, status: true } },
    },
  });
  const openByProject = new Map<string, Record<string, number>>();
  for (const p of projects) {
    const counts: Record<string, number> = {};
    for (const f of p.findings) if (f.status === "open") counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    openByProject.set(p.id, counts);
  }
  const SEV_COLOR: Record<string, string> = {
    critical: "text-signal",
    high: "text-sev-high",
    medium: "text-amber",
    low: "text-fg-muted",
    info: "text-fg-disabled",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Engagements</h1>
        <Link href="/engagements/new" className="btn btn-primary">
          New Engagement
        </Link>
      </div>

      {projects.length === 0 ? (
        <EmptyState message="No engagements yet." />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="table-dense w-full min-w-[52rem]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Application</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Phase</th>
                  <th>Open Findings</th>
                  <th>Dates</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-fg-primary">
                      <Link href={`/engagements/${p.id}`}>{p.code}</Link>
                    </td>
                  <td className="font-medium">{p.name}</td>
                  <td>{p.application.name}</td>
                  <td className="text-xs">{p.type.replace(/_/g, " ")}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    <PhaseRail current={p.phase} />
                  </td>
                  <td>
                    <span className="flex gap-1.5 text-xs">
                      {Object.entries(openByProject.get(p.id) ?? {})
                        .filter(([, n]) => n > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([sev, n]) => (
                          <span key={sev} className={`${SEV_COLOR[sev]} font-medium`} title={`${sev}: ${n}`}>
                            ●{n}
                          </span>
                        ))}
                      {(openByProject.get(p.id) ?? {}) && Object.values(openByProject.get(p.id) ?? {}).every((n) => !n) && (
                        <span className="text-fg-disabled">—</span>
                      )}
                    </span>
                  </td>
                  <td className="font-mono text-xs">
                    {p.startDate?.toISOString().slice(0, 10) ?? "?"} →{" "}
                    {p.endDate?.toISOString().slice(0, 10) ?? "?"}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
