import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  addFindingToReport,
  archiveReport,
  cloneReport,
  deleteEvidence,
  deleteReport,
  generateReport,
  moveReportFinding,
  removeReportFinding,
  unarchiveReport,
  updateReport,
  uploadEvidence,
} from "@/server/actions/reports";
import { ReportStatusBadge } from "../report-status-badge";
import { GenerationPoller } from "./generation-poller";

export default async function ReportBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      project: { include: { application: true } },
      findings: { orderBy: { position: "asc" } },
      evidence: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!report) notFound();

  // findings of the same engagement not yet added to this report
  const snapshotted = report.findings.map((f) => f.sourceId).filter(Boolean);
  const remaining = await prisma.finding.findMany({
    where: { projectId: report.projectId, id: { notIn: snapshotted as string[] } },
    orderBy: { createdAt: "desc" },
  });

  const busy = report.status === "queued" || report.status === "generating";

  return (
    <div className="space-y-4">
      <GenerationPoller active={busy} />

      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/engagements/${report.projectId}`} className="font-mono text-sm text-fg-muted hover:underline">
          {report.project.code}
        </Link>
        <h1 className="font-display text-xl font-semibold">{report.title}</h1>
        <span className="font-mono text-sm text-fg-muted">v{report.version}</span>
        <ReportStatusBadge status={report.status} />
        {report.archivedAt && <Badge color="gray">archived</Badge>}
        <div className="ml-auto flex gap-2">
          {!report.archivedAt && report.status === "generated" && (
            <form action={archiveReport}>
              <input type="hidden" name="id" value={report.id} />
              <button className="btn btn-secondary">Archive</button>
            </form>
          )}
          {report.archivedAt && (
            <form action={unarchiveReport}>
              <input type="hidden" name="id" value={report.id} />
              <button className="btn btn-secondary">Restore</button>
            </form>
          )}
          <form action={cloneReport}>
            <input type="hidden" name="id" value={report.id} />
            <button className="btn btn-secondary">Clone</button>
          </form>
          {report.status === "failed" && (
            <form action={generateReport}>
              <input type="hidden" name="id" value={report.id} />
              <button className="btn btn-secondary">Retry</button>
            </form>
          )}
          {report.filePath && (
            <a href={`/api/reports/${report.id}/download`} className="btn btn-secondary">
              Download PDF
            </a>
          )}
          <form action={generateReport}>
            <input type="hidden" name="id" value={report.id} />
            <button disabled={busy} className="btn btn-primary">
              {busy ? "Generating…" : "Generate PDF"}
            </button>
          </form>
        </div>
      </div>
      {report.status === "failed" && (
        <div className="rounded-sm bg-signal-dim px-3 py-2 text-xs text-signal">
          Last generation failed — check the worker process is running (`npm run worker`), then Retry.
        </div>
      )}

      {/* Findings snapshot */}
      <Panel title={`Findings (${report.findings.length})`} description="Immutable copies — editing a finding later won't change this report.">
        <table className="table-dense">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Severity</th>
              <th>CVSS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {report.findings.map((f, i) => (
              <tr key={f.id}>
                <td className="font-mono">F-{String(f.position).padStart(3, "0")}</td>
                <td className="font-medium">{f.title}</td>
                <td>{f.severity}</td>
                <td className="font-mono text-xs">{f.cvssScore === null ? "—" : Number(f.cvssScore)}</td>
                <td>
                  <div className="flex gap-1">
                    <form action={moveReportFinding}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button disabled={i === 0} className="btn btn-secondary px-1 py-px text-xs">↑</button>
                    </form>
                    <form action={moveReportFinding}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button disabled={i === report.findings.length - 1} className="btn btn-secondary px-1 py-px text-xs">↓</button>
                    </form>
                    <form action={removeReportFinding}>
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="reportId" value={report.id} />
                      <button className="btn btn-danger px-1 py-px text-xs">✕</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {report.findings.length === 0 && (
              <tr>
                <td colSpan={5} className="text-sm text-fg-muted">
                  No findings added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <form action={addFindingToReport} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
          <input type="hidden" name="reportId" value={report.id} />
          <select name="findingId" required className="input flex-1 text-xs">
            {remaining.map((f) => (
              <option key={f.id} value={f.id}>
                [{f.severity}] {f.title}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary" disabled={remaining.length === 0}>
            Add to report
          </button>
        </form>
      </Panel>

      {/* Evidence */}
      <Panel title={`Evidence (${report.evidence.length})`} description="Screenshots are embedded into the generated PDF.">
        <ul className="space-y-1">
          {report.evidence.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 rounded-sm bg-raised px-3 py-2 text-sm">
              <span>
                <a href={`/api/evidence/${e.id}`} className="text-blue hover:underline">
                  {e.filePath.split("/").pop()}
                </a>
                {e.caption && <span className="ml-2 text-xs text-fg-muted">{e.caption}</span>}
              </span>
              <form action={deleteEvidence}>
                <input type="hidden" name="id" value={e.id} />
                <button className="btn btn-danger px-1.5 py-0.5 text-xs">✕</button>
              </form>
            </li>
          ))}
          {report.evidence.length === 0 && <li className="text-sm text-fg-muted">No evidence uploaded.</li>}
        </ul>
        <form action={uploadEvidence} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line-subtle pt-3">
          <input type="hidden" name="reportId" value={report.id} />
          <div className="flex-1">
            <label className="label" htmlFor="file">
              File (png/jpg/webp/gif/pdf/txt/log, max 25 MB)
            </label>
            <input id="file" name="file" type="file" required className="input file:mr-2 file:rounded-sm file:border-0 file:bg-raised file:text-fg-secondary" />
          </div>
          <div className="w-56">
            <label className="label" htmlFor="caption">
              Caption
            </label>
            <input id="caption" name="caption" className="input" />
          </div>
          <button className="btn btn-secondary">Upload</button>
        </form>
      </Panel>

      {/* Meta edit */}
      <Panel title="Narrative & Metadata">
        <form action={updateReport} className="space-y-3">
          <input type="hidden" name="id" value={report.id} />
          <div>
            <label className="label" htmlFor="title">
              Title
            </label>
            <input id="title" name="title" required className="input" defaultValue={report.title} />
          </div>
          <div>
            <label className="label" htmlFor="execSummary">
              Executive summary (markdown)
            </label>
            <textarea id="execSummary" name="execSummary" rows={6} className="input font-mono text-xs" defaultValue={report.execSummary ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="conclusion">
              Conclusion (markdown)
            </label>
            <textarea id="conclusion" name="conclusion" rows={4} className="input font-mono text-xs" defaultValue={report.conclusion ?? ""} />
          </div>
          <button className="btn btn-primary">Save narrative</button>
        </form>
        <div className="mt-6 border-t border-line-subtle pt-4">
          <p className="label">Danger zone</p>
          <form action={deleteReport}>
            <input type="hidden" name="id" value={report.id} />
            <button className="btn btn-danger">Delete report</button>
          </form>
        </div>
      </Panel>

      <Link href="/reports" className="text-xs text-fg-muted hover:underline">
        ← Back to reports
      </Link>
    </div>
  );
}
