import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { VerdictChip, OutcomeDot } from "@/components/purple/verdict-chip";
import { TimelineEntryForm } from "@/components/purple/timeline-entry-form";
import { StateTimelineStrip } from "@/components/purple/state-timeline-strip";
import {
  confirmVerdict,
  deleteTimelineEntry,
  recorrelateVerdict,
} from "@/server/actions/purple";

const VERDICTS = ["detected", "not_detected", "partial", "detected_late", "untested"] as const;

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; verdict?: string; q?: string }>;
}) {
  const { project, verdict, q } = await searchParams;
  const entries = await prisma.timelineEntry.findMany({
    where: {
      AND: [
        project ? { projectId: project } : {},
        verdict ? { verdict: { verdict: verdict as never } } : {},
        q ? { techniqueId: { contains: q, mode: "insensitive" } } : {},
      ],
    },
    orderBy: { timestamp: "desc" },
    include: {
      project: { include: { application: true } },
      asset: true,
      operator: true,
      verdict: true,
    },
    take: 100,
  });
  const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Timeline — OPSEC Log</h1>

      <form className="flex flex-wrap gap-2" action="/timeline">
        <select name="project" defaultValue={project ?? ""} className="input w-auto">
          <option value="">All engagements</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.application.name}
            </option>
          ))}
        </select>
        <select name="verdict" defaultValue={verdict ?? ""} className="input w-auto">
          <option value="">All verdicts</option>
          {VERDICTS.map((v) => (
            <option key={v} value={v}>
              {v.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <input name="q" placeholder="Technique…" defaultValue={q} className="input max-w-[12rem]" />
        <button className="btn btn-secondary">Filter</button>
      </form>

      <Panel title="State Timeline" description="Latest verdict per technique over time (read-only strip).">
        <StateTimelineStrip
          entries={entries
            .slice()
            .reverse()
            .map((e) => ({ id: e.id, techniqueId: e.techniqueId ?? "?", timestamp: e.timestamp, verdict: e.verdict?.verdict ?? null }))}
        />
      </Panel>

      <Panel title={`Entries (${entries.length})`} toolbar>
        <table className="table-dense">
          <thead>
            <tr>
              <th>Time</th>
              <th>Engagement</th>
              <th>Technique</th>
              <th>Asset</th>
              <th>Action</th>
              <th>Verdict</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap font-mono text-xs">
                  <OutcomeDot outcome={e.outcome} />{" "}
                  {e.timestamp.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="font-mono text-xs">
                  <Link href={`/engagements/${e.projectId}`} className="hover:underline">
                    {e.project.code}
                  </Link>
                </td>
                <td className="font-mono text-xs text-violet">{e.techniqueId ?? "—"}</td>
                <td className="font-mono text-xs">{e.asset?.hostname ?? e.asset?.ipAddress ?? "—"}</td>
                <td>
                  <p className="max-w-md truncate">{e.actionDescription}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[11px] text-fg-muted hover:text-fg-secondary">
                      detail & verdict
                    </summary>
                    <div className="mt-2 max-w-xl space-y-2 rounded-sm bg-raised p-3 text-xs">
                      {e.command && (
                        <p className="break-all font-mono text-fg-primary">$ {e.command}</p>
                      )}
                      {e.technicalNotes && <p className="text-fg-secondary">{e.technicalNotes}</p>}
                      {e.note && <p className="text-fg-muted">note: {e.note}</p>}
                      <p className="text-fg-muted">
                        operator {e.operator?.name ?? "?"} · outcome {e.outcome}
                        {e.verdict?.matchedAlertId && ` · alert ${e.verdict.matchedAlertId}`}
                        {e.verdict?.detectionDelaySeconds != null &&
                          ` · delay ${e.verdict.detectionDelaySeconds}s`}
                      </p>

                      {!e.verdict?.confirmedByOperator ? (
                        <>
                          <form action={confirmVerdict} className="flex items-center gap-2">
                            <input type="hidden" name="timelineEntryId" value={e.id} />
                            <select name="verdict" defaultValue="" className="input w-auto py-0.5 text-xs">
                              <option value="">keep suggested</option>
                              {VERDICTS.map((v) => (
                                <option key={v} value={v}>
                                  override → {v.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                            <button className="btn btn-teal px-2 py-0.5 text-xs">Confirm</button>
                          </form>
                          {e.techniqueId && (
                            <form action={recorrelateVerdict}>
                              <input type="hidden" name="timelineEntryId" value={e.id} />
                              <button className="text-[11px] text-blue hover:underline">
                                re-run mock correlation
                              </button>
                            </form>
                          )}
                        </>
                      ) : (
                        <p className="text-teal">confirmed by operator ✓</p>
                      )}

                      <form action={deleteTimelineEntry}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="text-[11px] text-signal hover:underline">delete entry</button>
                      </form>
                    </div>
                  </details>
                </td>
                <td>
                  <VerdictChip verdict={e.verdict?.verdict} />
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-sm text-fg-muted">
                  No entries match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      <Panel title="Log new entry" description="Verdict is auto-correlated against the mocked Sentinel feed.">
        <TimelineEntryForm projectId={project} />
      </Panel>
    </div>
  );
}
