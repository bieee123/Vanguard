import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportStatusBadge } from "./report-status-badge";

export default async function ReportsPage() {
  const reports = await prisma.report.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { project: { include: { application: true } }, _count: { select: { findings: true, evidence: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Reports</h1>
        <div className="flex gap-2">
          <Link href="/reports/archive" className="btn btn-secondary">
            Archive
          </Link>
          <Link href="/reports/new" className="btn btn-primary">
            New Report
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          message="No reports yet — build one from an engagement's findings and generate a client-ready PDF."
          action={
            <Link href="/reports/new" className="btn btn-primary">
              New Report
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {/* design §6.8: dense library hybrid — each report is a compact panel */}
          {reports.map((r) => (
            <Panel key={r.id} className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/reports/${r.id}`} className="font-medium text-fg-primary hover:text-fg-primary">
                    {r.title}
                  </Link>
                  <span className="shrink-0 font-mono text-xs text-fg-muted">v{r.version}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-fg-muted">
                  {r.project.code} · {r.project.application.name}
                </p>
                <p className="mt-2 flex items-center gap-2 text-xs">
                  <ReportStatusBadge status={r.status} />
                  <span className="text-fg-muted">{r._count.findings} findings</span>
                  <span className="text-fg-muted">· {r._count.evidence} evidence</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-fg-muted">
                  {r.generatedAt ? `generated ${r.generatedAt.toISOString().slice(0, 16).replace("T", " ")}` : "not generated"}
                </p>
              </div>
              <div className="mt-3 flex gap-2 border-t border-line-subtle pt-2">
                <Link href={`/reports/${r.id}`} className="text-xs text-blue hover:text-blue">
                  open
                </Link>
                {r.filePath && (
                  <a href={`/api/reports/${r.id}/download`} className="text-xs text-blue hover:text-blue">
                    export PDF
                  </a>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
