import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PhaseRail } from "@/components/ui/phase-rail";

const TAB_KEYS = ["overview", "assets", "findings", "timeline", "purple", "report"] as const;
const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  assets: "Assets",
  findings: "Findings",
  timeline: "Timeline",
  purple: "Purple Team Sync",
  report: "Report",
};
import {
  linkAssetToEngagement,
  unlinkAssetFromEngagement,
} from "@/server/actions/assets";
import {
  createObservation,
  deleteObservation,
} from "@/server/actions/findings";
import { TimelineEntryForm } from "@/components/purple/timeline-entry-form";
import { VerdictChip, OutcomeDot } from "@/components/purple/verdict-chip";
import {
  addObjective,
  addDeconfliction,
  addProjectNote,
  addScopeItem,
  addSubTask,
  addTarget,
  addWhiteCard,
  assignUser,
  deleteObjective,
  deleteProjectNote,
  deleteScopeItem,
  deleteSubTask,
  deleteTarget,
  resolveDeconfliction,
  toggleSubTask,
  unassignUser,
  updateObjectiveStatus,
} from "@/server/actions/sub-resources";

export default async function EngagementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: activeTabRaw } = await searchParams;
  const activeTab = TAB_KEYS.includes((activeTabRaw ?? "overview") as never)
    ? (activeTabRaw ?? "overview")
    : "overview";
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      application: true,
      owner: true,
      assignments: { include: { user: true } },
      objectives: { include: { subTasks: true }, orderBy: { createdAt: "asc" } },
      scopes: { orderBy: { createdAt: "asc" } },
      targets: { orderBy: { createdAt: "asc" } },
      notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      deconflictions: { orderBy: { occurredAt: "desc" } },
      whiteCards: { include: { createdBy: true }, orderBy: { createdAt: "desc" } },
      assets: { include: { asset: true }, orderBy: { addedAt: "asc" } },
      findings: {
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
        include: { _count: { select: { assets: true } } },
      },
      observations: { orderBy: { createdAt: "desc" } },
      reports: { where: { archivedAt: null }, orderBy: { createdAt: "desc" } },
      timelineEntries: {
        orderBy: { timestamp: "desc" },
        take: 8,
        include: { asset: true, operator: true, verdict: true },
      },
    },
  });
  if (!project) notFound();

  const [users, allAssets] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.asset.findMany({ orderBy: [{ hostname: "asc" }, { ipAddress: "asc" }] }),
  ]);
  const linkedAssetIds = new Set(project.assets.map((a) => a.assetId));

  // header stat chips (design §6.3): coverage / gaps / open findings computed per engagement
  const projEntries = await prisma.timelineEntry.findMany({
    where: { projectId: project.id, techniqueId: { not: null } },
    select: { techniqueId: true, verdict: { select: { verdict: true } }, outcome: true },
    orderBy: { timestamp: "desc" },
  });
  const latestTech = new Map<string, string>();
  for (const e of projEntries) if (!latestTech.has(e.techniqueId!)) latestTech.set(e.techniqueId!, e.verdict?.verdict ?? "untested");
  const covered = [...latestTech.values()].filter((v) => ["detected", "detected_late"].includes(v)).length;
  const projCoverage = latestTech.size === 0 ? null : Math.round((covered / latestTech.size) * 100);
  const projGaps = [...latestTech.values()].filter((v) => ["not_detected", "partial"].includes(v)).length;
  const openFindings = project.findings.filter((f) => f.status === "open").length;

  const isOverview = activeTab === "overview";
  const show = {
    overview: isOverview,
    objectives: isOverview,
    scope: isOverview,
    targets: isOverview,
    assignments: isOverview,
    notes: isOverview,
    deconfliction: isOverview,
    whitecards: isOverview,
    observations: isOverview,
    assets: activeTab === "assets",
    findings: activeTab === "findings",
    timeline: activeTab === "timeline" || activeTab === "purple",
    reports: activeTab === "report",
  };
  const Show = ({ when, children }: { when: boolean; children: React.ReactNode }) =>
    when ? <>{children}</> : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Panel>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-sm text-fg-muted">{project.code}</span>
          <h1 className="font-display text-xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-fg-secondary">
          <PhaseRail current={project.phase} />
          <span>
            App:{" "}
            <Link href={`/applications/${project.application.id}`} className="text-blue hover:underline">
              {project.application.name}
            </Link>
          </span>
          <span className="font-mono text-xs">
            {project.startDate?.toISOString().slice(0, 10) ?? "?"} →{" "}
            {project.endDate?.toISOString().slice(0, 10) ?? "?"}
          </span>
          <span>Owner: {project.owner?.name ?? "—"}</span>
          <Link
            href={`/tasks?project=${project.id}`}
            className="btn btn-secondary inline-flex items-center gap-1.5 py-1"
          >
            <KanbanSquare size={13} strokeWidth={1.75} />
            Tasks
          </Link>
          <Link href={`/engagements/${project.id}/edit`} className="ml-auto btn btn-secondary py-1">
            Edit
          </Link>
        </div>
        {/* inline stat chips (design §6.3) */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
          <Badge color={projCoverage === null ? "gray" : projCoverage >= 80 ? "teal" : projCoverage >= 50 ? "amber" : "signal"}>
            coverage {projCoverage === null ? "—" : `${projCoverage}%`}
          </Badge>
          <Badge color={projGaps > 0 ? "signal" : "teal"}>{projGaps} gaps</Badge>
          <Badge color={openFindings > 0 ? "amber" : "teal"}>{openFindings} open findings</Badge>
          <Badge color="blue">{project.assets.length} assets</Badge>
          <Badge color="violet">{project.timelineEntries.length} entries</Badge>
        </div>
        {project.description && (
          <p className="mt-3 border-t border-line-subtle pt-3 text-sm text-fg-secondary">
            {project.description}
          </p>
        )}
      </Panel>

      {/* Tabs (server-rendered via ?tab=) */}
      <nav className="flex flex-wrap gap-1 border-b border-line-subtle">
        {TAB_KEYS.map((key) => (
          <Link
            key={key}
            href={`/engagements/${project.id}?tab=${key}`}
            className={`rounded-t-sm border-b-2 px-3 py-2 text-[13px] ${
              activeTab === key
                ? "border-signal bg-raised text-fg-primary"
                : "border-transparent text-fg-secondary hover:border-line-strong hover:text-fg-primary"
            }`}
          >
            {TAB_LABELS[key]}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Objectives */}
        <Show when={show.objectives}>
        <Panel title="Objectives & Subtasks">
          <ul className="space-y-3">
            {project.objectives.map((obj) => (
              <li key={obj.id} className="rounded-sm border border-line-subtle p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg-primary">{obj.title}</span>
                  <form action={updateObjectiveStatus} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={obj.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <select name="status" defaultValue={obj.status} className="input w-auto px-1.5 py-0.5 text-xs">
                      {["planned", "in_progress", "completed"].map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-secondary px-1.5 py-0.5 text-xs">Set</button>
                    <button formAction={deleteObjective} className="btn btn-danger px-1.5 py-0.5 text-xs">
                      ✕
                    </button>
                  </form>
                </div>
                <ul className="mt-2 space-y-1">
                  {obj.subTasks.map((st) => (
                    <li key={st.id} className="flex items-center justify-between gap-2 text-xs">
                      <form action={toggleSubTask} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="id" value={st.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="completed" value={st.completed ? "false" : "true"} />
                        <button
                          className={`btn px-1 py-px text-xs ${st.completed ? "btn-secondary text-teal" : "btn-secondary"}`}
                        >
                          {st.completed ? "☑" : "☐"}
                        </button>
                        <span className={st.completed ? "text-fg-muted line-through" : ""}>
                          {st.title}
                        </span>
                      </form>
                      <form action={deleteSubTask}>
                        <input type="hidden" name="id" value={st.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <button className="btn btn-danger px-1 py-px text-xs">✕</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form action={addSubTask} className="mt-2 flex gap-2">
                  <input type="hidden" name="objectiveId" value={obj.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input name="title" required placeholder="New subtask…" className="input flex-1 py-1 text-xs" />
                  <button className="btn btn-secondary py-1 text-xs">Add</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addObjective} className="mt-3 flex flex-col gap-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="title" required placeholder="New objective…" className="input" />
            <button className="btn btn-secondary self-start">Add Objective</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.scope}>
        {/* Scope */}
        <Panel title="Scope">
          {(["in_scope", "out_of_scope"] as const).map((dir) => (
            <div key={dir} className="mb-4 last:mb-0">
              <p className={`label ${dir === "in_scope" ? "!text-teal" : "!text-signal"}`}>
                {dir.replace("_", " ")}
              </p>
              <ul className="space-y-1">
                {project.scopes
                  .filter((s) => s.direction === dir)
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-xs">{s.value}</span>
                      <form action={deleteScopeItem}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <button className="btn btn-danger px-1 py-px text-xs">✕</button>
                      </form>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          <form action={addScopeItem} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <select name="direction" className="input w-auto text-xs">
              <option value="in_scope">in</option>
              <option value="out_of_scope">out</option>
            </select>
            <input name="value" required placeholder="10.0.0.0/24, app.corp…" className="input flex-1 font-mono text-xs" />
            <button className="btn btn-secondary">Add</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.targets}>
        {/* Targets */}
        <Panel title="Targets">
          <table className="table-dense">
            <thead>
              <tr>
                <th>Value</th>
                <th>Kind</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {project.targets.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono text-xs text-fg-primary">{t.value}</td>
                  <td>{t.kind}</td>
                  <td>
                    <form action={deleteTarget}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="btn btn-danger px-1 py-px text-xs">✕</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={addTarget} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="value" required placeholder="target value" className="input flex-1 font-mono text-xs" />
            <select name="kind" className="input w-auto text-xs">
              {["domain", "ip", "range", "url", "host"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <button className="btn btn-secondary">Add</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.assignments}>
        {/* Assignments */}
        <Panel title="Penanggung Jawab & Team">
          <ul className="space-y-1">
            {project.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {a.user.name}{" "}
                  <span className="text-xs text-fg-muted">— {a.role}</span>
                </span>
                <form action={unassignUser}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <button className="btn btn-danger px-1 py-px text-xs">✕</button>
                </form>
              </li>
            ))}
            {project.assignments.length === 0 && (
              <li className="text-sm text-fg-muted">No assignments.</li>
            )}
          </ul>
          <form action={assignUser} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <select name="userId" required className="input flex-1 text-xs">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input name="role" placeholder="role" defaultValue="operator" className="input w-28 text-xs" />
            <button className="btn btn-secondary">Assign</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.notes}>
        {/* Notes */}
        <Panel title="Notes">
          <ul className="space-y-2">
            {project.notes.map((n) => (
              <li key={n.id} className="rounded-sm bg-raised p-2.5 text-sm">
                <p className="whitespace-pre-wrap text-fg-secondary">{n.body}</p>
                <div className="mt-1 flex items-center justify-between text-[11px] text-fg-muted">
                  <span>
                    {n.author?.name ?? "unknown"} ·{" "}
                    {n.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                  <form action={deleteProjectNote}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="hover:text-signal">✕</button>
                  </form>
                </div>
              </li>
            ))}
            {project.notes.length === 0 && <li className="text-sm text-fg-muted">No notes.</li>}
          </ul>
          <form action={addProjectNote} className="mt-3 space-y-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <textarea name="body" required rows={2} placeholder="Add a note…" className="input" />
            <button className="btn btn-secondary">Add Note</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.deconfliction}>
        {/* Deconfliction */}
        <Panel title="Deconfliction Log">
          <ul className="space-y-2">
            {project.deconflictions.map((d) => (
              <li key={d.id} className="flex items-start justify-between gap-2 rounded-sm bg-raised p-2.5 text-sm">
                <div>
                  <p className="text-fg-secondary">{d.summary}</p>
                  <p className="mt-1 text-[11px] text-fg-muted">
                    {d.channel ?? "unspecified"} ·{" "}
                    {d.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
                  </p>
                </div>
                {d.resolved ? (
                  <Badge color="teal">resolved</Badge>
                ) : (
                  <form action={resolveDeconfliction}>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className="btn btn-secondary px-1.5 py-px text-xs">Resolve</button>
                  </form>
                )}
              </li>
            ))}
            {project.deconflictions.length === 0 && (
              <li className="text-sm text-fg-muted">No deconfliction entries.</li>
            )}
          </ul>
          <form action={addDeconfliction} className="mt-3 space-y-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="summary" required placeholder="What was coordinated with SOC?" className="input" />
            <div className="flex gap-2">
              <input name="channel" placeholder="channel (Slack, call…)" className="input flex-1" />
              <input name="occurredAt" type="datetime-local" className="input w-auto text-xs" />
              <button className="btn btn-secondary">Log</button>
            </div>
          </form>
        </Panel>
        </Show>

        <Show when={show.whitecards}>
        {/* White cards */}
        <Panel title="White Cards">
          <ul className="space-y-2">
            {project.whiteCards.map((w) => (
              <li key={w.id} className="rounded-sm border border-line-subtle p-2.5 text-sm">
                <p className="text-fg-secondary">{w.description}</p>
                <p className="mt-1 text-[11px] text-fg-muted">
                  by {w.createdBy?.name ?? "unknown"} ·{" "}
                  {w.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </p>
              </li>
            ))}
            {project.whiteCards.length === 0 && (
              <li className="text-sm text-fg-muted">No white cards issued.</li>
            )}
          </ul>
          <form action={addWhiteCard} className="mt-3 space-y-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <textarea
              name="description"
              required
              rows={2}
              placeholder="Authorized out-of-band action…"
              className="input"
            />
            <button className="btn btn-secondary">Issue White Card</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.assets}>
        {/* Assets (M3) */}
        <Panel title={`Assets (${project.assets.length})`}>
          <table className="table-dense">
            <thead>
              <tr>
                <th>Host / IP</th>
                <th>Criticality</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {project.assets.map(({ asset }) => (
                <tr key={asset.id}>
                  <td className="font-mono text-xs text-fg-primary">
                    <Link href={`/assets/${asset.id}`} className="hover:underline">
                      {asset.hostname ?? asset.ipAddress}
                    </Link>
                  </td>
                  <td>{asset.criticality}</td>
                  <td>
                    <form action={unlinkAssetFromEngagement}>
                      <input type="hidden" name="assetId" value={asset.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="btn btn-danger px-1 py-px text-xs">✕</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allAssets.filter((a) => !linkedAssetIds.has(a.id)).length > 0 && (
            <form action={linkAssetToEngagement} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
              <input type="hidden" name="projectId" value={project.id} />
              <select name="assetId" required className="input flex-1 font-mono text-xs">
                {allAssets
                  .filter((a) => !linkedAssetIds.has(a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.hostname ?? a.ipAddress}
                    </option>
                  ))}
              </select>
              <button className="btn btn-secondary">Link</button>
            </form>
          )}
        </Panel>
        </Show>

        <Show when={show.findings}>
        {/* Findings (M4) */}
        <Panel title={`Findings (${project.findings.length})`}>
          <div className="mb-3 flex gap-2">
            <Link href={`/findings/new?project=${project.id}`} className="btn btn-primary px-2 py-1 text-xs">
              New Finding
            </Link>
            <a href={`/api/projects/${project.id}/findings.csv`} className="btn btn-secondary px-2 py-1 text-xs">
              Export CSV
            </a>
          </div>
          <ul className="space-y-1">
            {project.findings.slice(0, 10).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/findings/${f.id}`} className="flex-1 truncate hover:underline">
                  <span
                    className={
                      f.severity === "critical" || f.severity === "high" ? "text-signal mr-2" : "text-fg-muted mr-2"
                    }
                  >
                    ●
                  </span>
                  {f.title}
                </Link>
                <span className="text-xs text-fg-muted">{f.severity}</span>
              </li>
            ))}
            {project.findings.length > 10 && (
              <li className="pt-1 text-xs text-fg-muted">
                +{project.findings.length - 10} more — see the Findings page.
              </li>
            )}
            {project.findings.length === 0 && (
              <li className="text-sm text-fg-muted">No findings recorded.</li>
            )}
          </ul>
        </Panel>
        </Show>

        <Show when={show.observations}>
        {/* Observations (M4, non-actionable) */}
        <Panel title={`Observations (${project.observations.length})`}>
          <ul className="space-y-2">
            {project.observations.map((o) => (
              <li key={o.id} className="rounded-sm bg-raised p-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{o.title}</span>
                  <form action={deleteObservation}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="text-fg-muted hover:text-signal">✕</button>
                  </form>
                </div>
                {o.body && <p className="mt-1 whitespace-pre-wrap text-xs text-fg-secondary">{o.body}</p>}
              </li>
            ))}
            {project.observations.length === 0 && (
              <li className="text-sm text-fg-muted">No observations.</li>
            )}
          </ul>
          <form action={createObservation} className="mt-3 space-y-2 border-t border-line-subtle pt-3">
            <input type="hidden" name="projectId" value={project.id} />
            <input name="title" required placeholder="Positive observation / noteworthy…" className="input" />
            <textarea name="body" rows={2} placeholder="Details (optional)" className="input" />
            <button className="btn btn-secondary self-start">Add Observation</button>
          </form>
        </Panel>
        </Show>

        <Show when={show.timeline}>
        {/* Timeline (M7) */}
        <Panel title={`Timeline (${project.timelineEntries.length}+)`} description="Latest OPSEC log entries — full history in the Timeline page.">
          <ul className="space-y-1">
            {project.timelineEntries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-mono text-[11px] text-fg-muted">
                    {e.timestamp.toISOString().slice(5, 16).replace("T", " ")}
                  </span>{" "}
                  {e.techniqueId && (
                    <Link href={`/timeline?q=${encodeURIComponent(e.techniqueId)}`} className="font-mono text-violet hover:underline">
                      {e.techniqueId}
                    </Link>
                  )}{" "}
                  <span className="text-fg-secondary">{e.actionDescription}</span>
                </span>
                <OutcomeDot outcome={e.outcome} />
                <VerdictChip verdict={e.verdict?.verdict} />
              </li>
            ))}
            {project.timelineEntries.length === 0 && (
              <li className="text-sm text-fg-muted">No offensive activity logged.</li>
            )}
          </ul>
          <details className="mt-3 border-t border-line-subtle pt-3">
            <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg-secondary">
              + Log new entry
            </summary>
            <div className="pt-3">
              <TimelineEntryForm projectId={project.id} />
            </div>
          </details>
        </Panel>
        </Show>

        <Show when={show.reports}>
        {/* Reports (M6) */}
        <Panel title={`Reports (${project.reports.length})`}>
          <div className="mb-3">
            <Link href={`/reports/new?project=${project.id}`} className="btn btn-primary px-2 py-1 text-xs">
              New Report
            </Link>
          </div>
          <ul className="space-y-1">
            {project.reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/reports/${r.id}`} className="flex-1 truncate hover:underline">
                  {r.title} <span className="ml-1 font-mono text-xs text-fg-muted">v{r.version}</span>
                </Link>
                <span className="text-xs text-fg-muted">{r.status}</span>
              </li>
            ))}
            {project.reports.length === 0 && (
              <li className="text-sm text-fg-muted">No reports yet.</li>
            )}
          </ul>
        </Panel>
        </Show>
      </div>
    </div>
  );
}
