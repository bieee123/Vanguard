import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { VerdictChip } from "@/components/purple/verdict-chip";
import { Drawer } from "@/components/ui/drawer";
import { createRuleRequest } from "@/server/actions/purple";

async function LatestDettctTeaser() {
  const run = await prisma.dettctRun.findFirst({ orderBy: { runAt: "desc" } });
  if (!run) {
    return (
      <p className="text-fg-muted">
        No DeTT&CT snapshot imported yet —{" "}
        <Link href="/dettct" className="text-blue hover:text-blue">
          import one
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono">
        {run.coveredCount}/{run.totalTechniques} techniques covered
      </span>
      <span className="text-fg-muted">· Last updated: {run.importedAt.toISOString().slice(0, 16).replace("T", " ")}</span>
      <Link href="/dettct" className="text-blue hover:text-blue">
        full snapshot →
      </Link>
    </div>
  );
}

const TACTIC_ORDER = [
  "reconnaissance",
  "initial-access",
  "execution",
  "persistence",
  "privilege-escalation",
  "defense-evasion",
  "credential-access",
  "discovery",
  "lateral-movement",
  "collection",
  "exfiltration",
];
const VERDICTS = ["detected", "not_detected", "partial", "detected_late", "untested"] as const;

const TILE_COLOR: Record<string, string> = {
  detected: "bg-teal-dim border-teal text-teal",
  not_detected: "bg-signal-dim border-signal text-signal",
  partial: "bg-amber-dim border-amber text-amber",
  detected_late: "bg-amber-dim border-amber text-amber",
  untested: "bg-raised border-line-strong text-fg-secondary",
};

export default async function AttackMatrixPage({
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
      asset: true,
      project: true,
      verdict: true,
      ruleRequests: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    take: 500,
  });
  const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });

  // group by technique → latest entry wins the tile color
  const tiles = new Map<
    string,
    { techniqueId: string; tactic: string; count: number; verdict: string; entries: typeof entries }
  >();
  for (const e of entries) {
    if (!e.techniqueId) continue;
    const t = tiles.get(e.techniqueId);
    if (t) {
      t.count++;
      t.entries.push(e);
    } else {
      tiles.set(e.techniqueId, {
        techniqueId: e.techniqueId,
        tactic: e.tactic ?? "uncategorized",
        count: 1,
        verdict: e.verdict?.verdict ?? "untested",
        entries: [e],
      });
    }
  }

  const tactics = [...new Set([...tiles.values()].map((t) => t.tactic))].sort(
    (a, b) => (TACTIC_ORDER.indexOf(a) + 100) % 99 - (TACTIC_ORDER.indexOf(b) + 100) % 99
  );

  // gap analytics: successful actions that were NOT detected
  const gaps = entries.filter(
    (e) => e.outcome === "success" && e.verdict && ["not_detected", "partial"].includes(e.verdict.verdict)
  );
  const gapByTechnique = new Map<string, typeof gaps>();
  for (const g of gaps) {
    const list = gapByTechnique.get(g.techniqueId!) ?? [];
    list.push(g);
    gapByTechnique.set(g.techniqueId!, list);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">ATT&CK Matrix — Purple Team View</h1>
        <Link href="/timeline" className="btn btn-secondary">
          Timeline
        </Link>
      </div>

      {/* toolbar */}
      <form className="flex flex-wrap gap-2" action="/attack-matrix">
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
        <input name="q" placeholder="Search technique…" defaultValue={q} className="input max-w-[14rem]" />
        <button className="btn btn-secondary">Apply</button>
      </form>

      {/* heatmap */}
      <Panel title="Heatmap" description="Tile color = verdict of the most recent test. Click a tile for its history." toolbar>
        {tiles.size === 0 ? (
          <p className="text-sm text-fg-muted">
            No technique data yet — log entries in the <Link href="/timeline" className="text-blue hover:text-blue">Timeline</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-1">
              <thead>
                <tr>
                  {tactics.map((tactic) => (
                    <th key={tactic} className="px-0.5 pb-2 align-bottom">
                      {/* diagonal (-45°) tactic label so it reads while columns stay narrow */}
                      <div className="relative h-24 w-5">
                        <span className="absolute bottom-0 left-0 origin-bottom-left -rotate-45 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                          {tactic.replace(/-/g, " ")}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {tactics.map((tactic) => (
                    <td key={tactic} className="align-top">
                      {[...tiles.values()]
                        .filter((t) => t.tactic === tactic)
                        .map((t) => (
                          <Drawer
                            key={t.techniqueId}
                            title={`Technique ${t.techniqueId}`}
                            widthClass="max-w-lg"
                            triggerClass="mb-1 block w-full"
                            label={
                              <span
                                className={`flex h-12 w-24 flex-col items-start justify-center rounded-sm border px-2 ${TILE_COLOR[t.verdict]}`}
                              >
                                <span className="font-mono text-[11px] leading-tight">{t.techniqueId}</span>
                                <span className="text-[10px] opacity-70">{t.count}×</span>
                              </span>
                            }
                          >
                            <div className="space-y-2 text-xs">
                              <p className="font-semibold">History — {t.techniqueId}</p>
                              {t.entries.slice(0, 5).map((e) => (
                                <div key={e.id} className="rounded-sm bg-raised p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] text-fg-muted">
                                      {e.timestamp.toISOString().slice(0, 16).replace("T", " ")} · {e.project.code}
                                      {e.asset ? ` · ${e.asset.hostname ?? e.asset.ipAddress}` : ""}
                                    </span>
                                    <VerdictChip verdict={e.verdict?.verdict} />
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-fg-secondary">{e.actionDescription}</p>
                                </div>
                              ))}
                              {t.entries.length > 5 && <p className="text-fg-muted">+{t.entries.length - 5} older…</p>}
                              <Link
                                href={`/timeline?q=${encodeURIComponent(t.techniqueId)}`}
                                className="text-blue hover:text-blue"
                              >
                                open in timeline →
                              </Link>
                            </div>
                          </Drawer>
                        ))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {/* DeTT&CT long-term coverage: read-only snapshot, visually distinct from live data above */}
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-fg-muted">Long-term Coverage (DeTT&CT)</summary>
          <div className="pt-2 text-xs">
            <LatestDettctTeaser />
          </div>
        </details>
      </Panel>

      {/* gap analytics */}
      <Panel title={`Detection Gap Analytics (${gapByTechnique.size})`} description="Successful techniques that were not detected. Send to Sentinel backlog to draft a rule." toolbar>
        {gapByTechnique.size === 0 ? (
          <p className="text-sm text-fg-muted">No open gaps — either nothing tested or everything detected.</p>
        ) : (
          <table className="table-dense">
            <thead>
              <tr>
                <th>Technique</th>
                <th>Attempts</th>
                <th>Engagements</th>
                <th>Last tested</th>
                <th>Rule request</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...gapByTechnique.entries()].map(([technique, list]) => {
                const latestRR = list.find((g) => g.ruleRequests.length)?.ruleRequests[0] ?? null;
                return (
                  <tr key={technique}>
                    <td className="font-mono text-violet">{technique}</td>
                    <td className="font-mono">{list.length}</td>
                    <td className="text-xs">{[...new Set(list.map((g) => g.project.code))].join(", ")}</td>
                    <td className="font-mono text-xs">{list[0].timestamp.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      {latestRR ? (
                        <span className="text-xs">
                          {latestRR.status}
                          {latestRR.status !== "verified" && latestRR.status !== "rejected" && (
                            <Link href="/rule-requests" className="ml-2 text-blue hover:text-blue">
                              manage
                            </Link>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-signal">none</span>
                      )}
                    </td>
                    <td>
                      {!latestRR && (
                        <details className="w-96">
                          <summary className="btn btn-primary cursor-pointer list-none px-2 py-0.5 text-xs">
                            Send to Sentinel backlog
                          </summary>
                          <form action={createRuleRequest} className="mt-2 space-y-2 rounded-sm border border-line-default bg-raised p-3">
                            <input type="hidden" name="techniqueId" value={technique} />
                            <input type="hidden" name="projectId" value={list[0].projectId} />
                            <input type="hidden" name="timelineEntryId" value={list[0].id} />
                            <p className="label !mb-0">Justification</p>
                            <textarea
                              name="justification"
                              rows={2}
                              className="input"
                              defaultValue={`Gap: ${technique} succeeded undetected on ${[...new Set(list.map((g) => g.asset?.hostname ?? g.asset?.ipAddress ?? "?"))].join(", ")}.`}
                            />
                            <p className="label !mb-0">Draft rule XML (editable later)</p>
                            <textarea name="draftRuleXml" rows={3} className="input font-mono text-[11px]" placeholder="leave empty for template" />
                            <button className="btn btn-teal px-2 py-0.5 text-xs">Create draft</button>
                          </form>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* lifecycle legend */}
      <Panel title="Rule Request Lifecycle" description="UI allows submit & verify only; other transitions are Sentinel-side (simulated commands until M12).">
        <p className="font-mono text-xs text-fg-secondary">
          draft → pending_review → approved → deployed → verified&nbsp;&nbsp;(+ rejected branch from review)
        </p>
        <Link href="/rule-requests" className="btn btn-secondary mt-3 inline-flex">
          Rule Requests queue
        </Link>
      </Panel>
    </div>
  );
}
