import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge } from "@/components/findings/finding-form";
import { Drawer } from "@/components/ui/drawer";
import { Sparkline } from "@/components/ui/sparkline";

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string; projectId?: string; q?: string }>;
}) {
  const { severity, status, projectId, q } = await searchParams;
  const where = {
    AND: [
      severity ? { severity: severity as never } : {},
      status ? { status: status as never } : {},
      projectId ? { projectId } : {},
      q ? { title: { contains: q, mode: "insensitive" as const } } : {},
    ],
  };

  const [findings, projects] = await Promise.all([
    prisma.finding.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        project: { include: { application: true } },
        tags: { include: { tag: true } },
        assets: { include: { asset: true } },
      },
    }),
    prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } }),
  ]);

  // ── investigation dashboard aggregates (design §6.4) ──
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const bySeverity = new Map<string, number>();
  for (const f of findings) bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
  const cvssBuckets = new Array(10).fill(0);
  const dated = new Map<string, number>();
  const assetCounts = new Map<string, { name: string; count: number }>();
  for (const f of findings) {
    if (f.cvssScore !== null) cvssBuckets[Math.min(9, Math.floor(Number(f.cvssScore)))]++;
    const day = f.createdAt.toISOString().slice(5, 10);
    dated.set(day, (dated.get(day) ?? 0) + 1);
    for (const fa of f.assets)
      if (fa.asset.hostname || fa.asset.ipAddress) {
        const name = fa.asset.hostname ?? fa.asset.ipAddress!;
        assetCounts.set(name, { name, count: (assetCounts.get(name)?.count ?? 0) + 1 });
      }
  }
  const topAssets = [...assetCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Findings — Investigation</h1>
        <Link href="/findings/new" className="btn btn-primary">
          New Finding
        </Link>
      </div>

      {/* stat panels row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="label">Total Findings</p>
          <p className="font-mono text-2xl">{findings.length}</p>
        </Panel>
        <Panel>
          <p className="label">Critical</p>
          <p className={`font-mono text-2xl ${criticalCount > 0 ? "text-signal" : ""}`}>{criticalCount}</p>
        </Panel>
        <Panel className="xl:col-span-1">
          <p className="label">Findings / day (30d)</p>
          <Sparkline points={Array.from({ length: 30 }, (_, i) => dated.get(dayLabel(i)) ?? 0)} />
        </Panel>
        <Panel>
          <p className="label">Top Affected Asset</p>
          <p className="truncate font-mono text-lg text-fg-primary">{topAssets[0]?.name ?? "—"}</p>
          <p className="text-[11px] text-fg-muted">{topAssets[0]?.count ?? 0} findings</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Severity Distribution" toolbar>
          <div className="space-y-1.5">
            {["critical", "high", "medium", "low", "info"].map((sev) => {
              const count = bySeverity.get(sev) ?? 0;
              const pct = findings.length ? (count / findings.length) * 100 : 0;
              return (
                <div key={sev} className="flex items-center gap-2 text-xs">
                  <span className="w-16 capitalize text-fg-secondary">{sev}</span>
                  <div className="h-2 flex-1 rounded-sm bg-raised">
                    <div className="h-full rounded-sm bg-signal/70" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right font-mono text-fg-muted">{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="CVSS Distribution" description="Base score histogram" toolbar>
          <div className="flex h-28 items-end gap-1">
            {cvssBuckets.map((count, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm bg-blue/70"
                  style={{ height: `${findings.length ? Math.max(count ? 8 : 2, (count / Math.max(...cvssBuckets, 1)) * 100) : 2}%` }}
                  title={`${i}.x: ${count}`}
                />
                <span className="font-mono text-[9px] text-fg-muted">{i}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Top Affected Assets" toolbar>
          <ul className="space-y-1.5">
            {topAssets.map((a) => (
              <li key={a.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-mono text-fg-primary">{a.name}</span>
                <span className="font-mono text-fg-muted">{a.count}</span>
              </li>
            ))}
            {topAssets.length === 0 && <li className="text-fg-muted">No linked assets yet.</li>}
          </ul>
        </Panel>
      </div>

      {/* filters */}
      <form className="flex flex-wrap gap-2" action="/findings">
        <input name="q" placeholder="Search title…" defaultValue={q} className="input max-w-xs" />
        <select name="projectId" defaultValue={projectId ?? ""} className="input w-auto">
          <option value="">All engagements</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.application.name}
            </option>
          ))}
        </select>
        <select name="severity" defaultValue={severity ?? ""} className="input w-auto">
          <option value="">All severity</option>
          {["critical", "high", "medium", "low", "info"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">All status</option>
          {["open", "retest", "fixed", "accepted_risk", "false_positive"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary">Filter</button>
      </form>

      {findings.length === 0 ? (
        <EmptyState message="No findings match this filter." />
      ) : (
        <Panel title={`Results (${findings.length})`} toolbar>
          <table className="table-dense">
            <thead>
              <tr>
                <th>Engagement</th>
                <th>Title</th>
                <th>Severity</th>
                <th>CVSS</th>
                <th>Status</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id}>
                  <td className="font-mono text-xs">{f.project.code}</td>
                  <td className="max-w-sm truncate font-medium text-fg-primary">
                    <Drawer
                      label={f.title}
                      triggerClass="hover:text-blue hover:underline block w-full truncate"
                      title={f.title}
                      widthClass="max-w-2xl"
                    >
                      <FindingDetailDrawer findingId={f.id} />
                    </Drawer>
                  </td>
                  <td>
                    <SeverityBadge severity={f.severity} />
                  </td>
                  <td className="font-mono text-xs">{f.cvssScore === null ? "—" : Number(f.cvssScore)}</td>
                  <td>{f.status.replace(/_/g, " ")}</td>
                  <td className="text-xs text-fg-muted">{f.tags.map((t) => t.tag.name).join(", ") || "—"}</td>
                  <td>
                    <Link href={`/findings/${f.id}`} className="text-xs text-blue hover:underline">
                      open →
                    </Link>
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

function dayLabel(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(5, 10);
}

/** Drawer body — server component fetching the full record. */
async function FindingDetailDrawer({ findingId }: { findingId: string }) {
  const f = await prisma.finding.findUniqueOrThrow({
    where: { id: findingId },
    include: { assets: { include: { asset: true } }, type: true },
  });
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <span className="text-xs">{f.status.replace(/_/g, " ")}</span>
        {f.type && <span className="text-xs text-fg-muted">type: {f.type.name}</span>}
        {f.cve && <span className="font-mono text-xs">{f.cve}</span>}
        {f.cwe && <span className="font-mono text-xs">{f.cwe}</span>}
        {f.cvssScore !== null && (
          <span className="font-mono text-xs">
            CVSS {Number(f.cvssScore)} {f.cvssVector && `(${f.cvssVector})`}
          </span>
        )}
      </div>
      {f.attackTechniques.length > 0 && (
        <p className="font-mono text-xs text-violet">{f.attackTechniques.join(" · ")}</p>
      )}
      {f.description && (
        <section>
          <p className="label">Description</p>
          <p className="whitespace-pre-wrap text-fg-secondary">{f.description}</p>
        </section>
      )}
      {f.replication && (
        <section>
          <p className="label">Replication steps</p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-sm bg-raised p-2 font-mono text-xs">
            {f.replication}
          </pre>
        </section>
      )}
      {f.mitigation && (
        <section>
          <p className="label">Remediation</p>
          <p className="whitespace-pre-wrap text-fg-secondary">{f.mitigation}</p>
        </section>
      )}
      <section>
        <p className="label">Affected assets</p>
        {f.assets.length ? (
          <ul className="space-y-0.5 font-mono text-xs">
            {f.assets.map(({ asset }) => (
              <li key={asset.id}>{asset.hostname ?? asset.ipAddress}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-fg-muted">none linked</p>
        )}
      </section>
      {f.references.length > 0 && (
        <section>
          <p className="label">References</p>
          <ul className="space-y-0.5 text-xs">
            {f.references.map((r) => (
              <li key={r} className="break-all font-mono text-blue">
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href={`/findings/${f.id}`} className="btn btn-secondary mt-2 inline-flex">
        Open full editor →
      </Link>
    </div>
  );
}
