import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { createReport } from "@/server/actions/reports";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: preselect } = await searchParams;
  const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });

  if (projects.length === 0) {
    return (
      <EmptyState
        message="Reports are built from an engagement — create one first."
        action={
          <Link href="/engagements/new" className="btn btn-primary">
            New Engagement
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Report</h1>
      <Panel>
        <form action={createReport} className="space-y-3">
          <div>
            <label className="label" htmlFor="projectId">
              Engagement *
            </label>
            <select id="projectId" name="projectId" required className="input" defaultValue={preselect ?? ""}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.application.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="title">
              Title *
            </label>
            <input id="title" name="title" required className="input" placeholder="Acme External Assessment — Final Report" />
          </div>
          <div>
            <label className="label" htmlFor="execSummary">
              Executive summary (markdown)
            </label>
            <textarea id="execSummary" name="execSummary" rows={5} className="input font-mono text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="conclusion">
              Conclusion (markdown)
            </label>
            <textarea id="conclusion" name="conclusion" rows={4} className="input font-mono text-xs" />
          </div>
          <button className="btn btn-primary">Create draft</button>
        </form>
      </Panel>
      <Link href="/reports" className="text-xs text-fg-muted hover:underline">
        ← Back to reports
      </Link>
    </div>
  );
}
