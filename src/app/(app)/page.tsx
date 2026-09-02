import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusIndicator } from "@/components/dashboard/status-indicator";
import { SeverityDonut } from "@/components/dashboard/severity-donut";
import { CoverageLine } from "@/components/dashboard/coverage-line";
import { SEVERITY_HEX } from "@/components/dashboard/severity-colors";
import { VerdictChip, OutcomeDot } from "@/components/purple/verdict-chip";
import { Sparkline, TrendDelta } from "@/components/ui/sparkline";
import { Drawer } from "@/components/ui/drawer";

const COVERED = new Set(["detected", "detected_late"]);
const WINDOW_HOURS: Record<string, number> = { "24h": 24, "7d": 168, "30d": 720 };

function dayBuckets(dates: Date[], days = 30): number[] {
  const out = new Array(days).fill(0);
  const cutoff = Date.now() - days * 86_400_000;
  for (const d of dates) {
    const age = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (d.getTime() >= cutoff && age < days) out[days - 1 - age]++;
  }
  return out;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = searchParams ? (await searchParams).range ?? "24h" : "24h";
  const windowDays = WINDOW_HOURS[range] ? WINDOW_HOURS[range] / 24 : null; // null = all
  const cutoff = windowDays ? new Date(Date.now() - windowDays * 86_400_000) : null;

  const [
    applicationCount,
    activeEngagements,
    openCritical,
    severityDist,
    testedEntriesRaw,
    recentRaw,
    engagementDates,
    criticalDates,
  ] = await Promise.all([
    prisma.application.count(),
    prisma.project.findMany({
      where: { status: { in: ["planned", "active", "paused"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.finding.count({ where: { severity: "critical", status: "open" } }),
    prisma.finding.groupBy({ by: ["severity"], _count: true }),
    // techniques tested at least once, with verdicts
    prisma.timelineEntry.findMany({
      where: { techniqueId: { not: null }, verdict: { isNot: null } },
      select: {
        techniqueId: true,
        timestamp: true,
        projectId: true,
        assetId: true,
        outcome: true,
        actionDescription: true,
        project: { select: { code: true } },
        asset: { select: { hostname: true, ipAddress: true } },
        verdict: { select: { verdict: true, confirmedByOperator: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 400,
    }),
    prisma.timelineEntry.findMany({
      where: { techniqueId: { not: null }, ...(cutoff ? { timestamp: { gte: cutoff } } : {}) },
      orderBy: { timestamp: "desc" },
      take: 8,
      select: {
        id: true,
        timestamp: true,
        techniqueId: true,
        actionDescription: true,
        command: true,
        technicalNotes: true,
        note: true,
        operator: { select: { name: true } },
        project: { select: { code: true } },
        asset: { select: { hostname: true, ipAddress: true } },
        tactic: true,
        outcome: true,
        verdict: { select: { verdict: true, matchedAlertId: true, detectionDelaySeconds: true, confirmedByOperator: true } },
      },
    }),
    prisma.project.findMany({ select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.finding.findMany({ where: { severity: "critical" }, select: { createdAt: true } }),
  ]);

  if (applicationCount === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          message="No engagement data yet — create your first application and engagement to populate this dashboard."
          action={
            <Link href="/applications/new" className="btn btn-primary">
              New Application
            </Link>
          }
        />
      </div>
    );
  }

  // coverage over distinct techniques; latest entry per technique decides its state
  const tested = testedEntriesRaw
    .filter((e): e is typeof e & { verdict: { verdict: string } } => e.verdict !== null)
    .map((e) => ({ ...e, techniqueId: e.techniqueId as string }));
  const latestByTechnique = new Map<string, (typeof tested)[number]>();
  for (const e of tested) {
    if (!latestByTechnique.has(e.techniqueId)) latestByTechnique.set(e.techniqueId, e);
  }
  const testedCount = latestByTechnique.size;
  const coveredCount = [...latestByTechnique.values()].filter((e) =>
    COVERED.has(e.verdict.verdict)
  ).length;
  const coveragePct = testedCount === 0 ? null : Math.round((coveredCount / testedCount) * 100);
  const gapTechniques = [...latestByTechnique.values()].filter(
    (e) => ["not_detected", "partial"].includes(e.verdict.verdict)
  );

  // cumulative coverage % per day (verdict timestamp drives the step line)
  const dated = tested.slice().reverse();
  const running = new Map<string, boolean>();
  const series: { day: string; pct: number }[] = [];
  for (const e of dated) {
    if (cutoff && e.timestamp < cutoff) continue;
    running.set(e.techniqueId, COVERED.has(e.verdict.verdict) || (running.get(e.techniqueId) ?? false));
    const pct = Math.round(([...running.values()].filter(Boolean).length / running.size) * 100);
    const day = e.timestamp.toISOString().slice(5, 10);
    if (series.length && series[series.length - 1].day === day) series[series.length - 1].pct = pct;
    else series.push({ day, pct });
  }
  // sparkline series (last 30 days regardless of range — trend context)
  const engagementSpark = dayBuckets(engagementDates.map((p) => p.createdAt));
  const criticalSpark = dayBuckets(criticalDates.map((f) => f.createdAt));

  return (
    <div className="space-y-4">
      {/* Row 1 — stat panels */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="label">Active Engagements</p>
          <p className="font-mono text-2xl">{activeEngagements.length}</p>
          <Sparkline points={engagementSpark} />
          <TrendDelta series={engagementSpark} />
        </Panel>
        <Panel>
          <p className="label">Open Critical Findings</p>
          <p className={`font-mono text-2xl ${openCritical > 0 ? "text-signal" : ""}`}>{openCritical}</p>
          <Sparkline points={criticalSpark} color="#E5484D" />
          <TrendDelta series={criticalSpark} />
        </Panel>
        <Panel>
          <p className="label">Detection Coverage</p>
          <p className={`font-mono text-2xl ${coveragePct === null ? "text-fg-disabled" : "text-teal"}`}>
            {coveragePct === null ? "—" : `${coveragePct}%`}
          </p>
          <Sparkline points={series.map((s) => s.pct)} color="#35B7A0" />
          <p className="text-[11px] text-fg-muted">{testedCount} techniques tested</p>
        </Panel>
        <Panel>
          <p className="label">Detection Gaps</p>
          <p className={`font-mono text-2xl ${gapTechniques.length > 0 ? "text-signal" : "text-fg-disabled"}`}>
            {gapTechniques.length}
          </p>
          <Link href="/attack-matrix" className="text-[11px] text-blue hover:underline">
            view in matrix →
          </Link>
        </Panel>
      </div>

      {/* Row 2 — analytics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Detection Coverage Over Time" toolbar>
          <CoverageLine points={series} />
        </Panel>
        <Panel title="Severity Distribution" toolbar>
          <SeverityDonut data={severityDist.map((s) => ({ severity: s.severity, count: s._count }))} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {severityDist.map((s) => (
              <span key={s.severity} className="flex items-center gap-1.5 text-fg-secondary">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: SEVERITY_HEX[s.severity] ?? "#667085" }}
                />
                {s.severity}: {s._count}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      {/* Row 3 — heatmap teaser */}
      <Panel
        title="ATT&CK Coverage"
        actions={
          <Link href="/attack-matrix" className="btn btn-secondary px-2 py-0.5 text-xs">
            full matrix →
          </Link>
        }
      >
        <div className="flex flex-wrap gap-1">
          {[...latestByTechnique.values()].slice(0, 18).map((e) => (
            <span
              key={e.techniqueId}
              title={`${e.techniqueId} · ${e.verdict.verdict}`}
              className={`rounded-sm border px-2 py-1 font-mono text-[11px] ${
                e.verdict.verdict === "detected"
                  ? "border-teal bg-teal-dim text-teal"
                  : e.verdict.verdict === "not_detected"
                    ? "border-signal bg-signal-dim text-signal"
                    : e.verdict.verdict === "untested"
                      ? "border-line-strong bg-raised text-fg-secondary"
                      : "border-amber bg-amber-dim text-amber"
              }`}
            >
              {e.techniqueId}
            </span>
          ))}
          {testedCount === 0 && <p className="text-sm text-fg-muted">No techniques tested yet.</p>}
        </div>
      </Panel>

      {/* Row 4 — state timeline (rows open an entry drawer) */}
      <Panel title="Recent Activity" toolbar>
        <table className="table-dense">
          <thead>
            <tr>
              <th>Time</th>
              <th>Technique</th>
              <th>Engagement</th>
              <th>Tactic</th>
              <th>Action</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {recentRaw.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap font-mono text-xs">
                  <OutcomeDot outcome={e.outcome} /> {e.timestamp.toISOString().slice(11, 19)}
                </td>
                <td className="font-mono text-violet">{e.techniqueId}</td>
                <td className="font-mono text-xs">{e.project.code}</td>
                <td className="text-xs">{e.tactic?.replace(/-/g, " ") ?? "—"}</td>
                <td className="max-w-md truncate text-xs">
                  <Drawer
                    label={e.actionDescription}
                    triggerClass="hover:text-blue hover:underline w-full block truncate"
                    title={`${e.techniqueId ?? "entry"} — ${e.project.code}`}
                  >
                    <div className="space-y-3 text-sm">
                      <p className="font-mono text-xs text-fg-muted">
                        {e.timestamp.toISOString().replace("T", " ").slice(0, 19)} ·{" "}
                        {e.asset?.hostname ?? e.asset?.ipAddress ?? "no asset"} · operator{" "}
                        {e.operator?.name ?? "?"}
                      </p>
                      <p className="text-fg-secondary">{e.actionDescription}</p>
                      {e.command && (
                        <pre className="overflow-x-auto rounded-sm bg-raised p-2 font-mono text-xs text-fg-primary">
                          $ {e.command}
                        </pre>
                      )}
                      {e.technicalNotes && <p className="text-fg-secondary">{e.technicalNotes}</p>}
                      {e.note && <p className="text-xs text-fg-muted">note: {e.note}</p>}
                      <div className="flex items-center gap-2 border-t border-line-subtle pt-3">
                        <VerdictChip verdict={e.verdict?.verdict} />
                        {e.verdict?.confirmedByOperator ? (
                          <span className="text-xs text-teal">operator confirmed ✓</span>
                        ) : (
                          <Link href="/timeline" className="text-xs text-blue hover:underline">
                            confirm in timeline →
                          </Link>
                        )}
                      </div>
                      {e.verdict?.matchedAlertId && (
                        <p className="font-mono text-[11px] text-fg-muted">
                          alert {e.verdict.matchedAlertId}
                          {e.verdict.detectionDelaySeconds != null &&
                            ` · delay ${e.verdict.detectionDelaySeconds}s`}
                        </p>
                      )}
                    </div>
                  </Drawer>
                </td>
                <td>
                  <VerdictChip verdict={e.verdict?.verdict} />
                </td>
              </tr>
            ))}
            {recentRaw.length === 0 && (
              <tr>
                <td colSpan={6} className="text-sm text-fg-muted">
                  No offensive activity in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>

      {/* Row 5 — integration health */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <StatusIndicator label="VANGUARD → SENTINEL" state="inactive" detail="inactive — last sync never (M12)" />
        </Panel>
        <Panel>
          <StatusIndicator label="SENTINEL → WAZUH" state="inactive" detail="read-only · external (informational)" />
        </Panel>
        <Panel>
          <StatusIndicator label="AI PROVIDER" state="inactive" detail="not configured — sources-only RAG" />
        </Panel>
      </div>
    </div>
  );
}
