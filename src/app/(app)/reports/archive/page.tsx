import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ReportArchivePage() {
  const reports = await prisma.report.findMany({
    where: { archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    include: { project: { include: { application: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Report Archive</h1>
        <Link href="/reports" className="btn btn-secondary">
          ← Active reports
        </Link>
      </div>

      {reports.length === 0 ? (
        <EmptyState message="Archived reports land here — immutable copies kept for history." />
      ) : (
        <Panel>
          <table className="table-dense">
            <thead>
              <tr>
                <th>Title</th>
                <th>Engagement</th>
                <th>Version</th>
                <th>Archived</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium text-fg-primary">
                    <Link href={`/reports/${r.id}`} className="hover:text-blue">
                      {r.title}
                    </Link>
                  </td>
                  <td>
                    <span className="font-mono text-xs">{r.project.code}</span>{" "}
                    <span className="text-xs">{r.project.application.name}</span>
                  </td>
                  <td className="font-mono">v{r.version}</td>
                  <td className="font-mono text-xs">{r.archivedAt?.toISOString().slice(0, 10)}</td>
                  <td>
                    {r.filePath ? (
                      <a href={`/api/reports/${r.id}/download`} className="text-blue hover:text-blue">
                        download
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
