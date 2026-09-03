import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { addFindingType, deleteFindingType } from "@/server/actions/findings";

export default async function FindingsSettingsPage() {
  const [types, byType] = await Promise.all([
    prisma.findingType.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { findings: true } } } }),
    prisma.finding.groupBy({ by: ["severity"], _count: true }),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Finding Types">
        <ul className="space-y-1">
          {types.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm">
              <span>
                {t.name} <span className="ml-2 text-xs text-fg-muted">{t._count.findings} findings</span>
              </span>
              <form action={deleteFindingType}>
                <input type="hidden" name="id" value={t.id} />
                <button className="btn btn-danger px-1.5 py-0.5 text-xs">✕</button>
              </form>
            </li>
          ))}
          {types.length === 0 && <li className="text-sm text-fg-muted">No types defined yet.</li>}
        </ul>
        <form action={addFindingType} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
          <input name="name" required placeholder="e.g. SQL Injection" className="input flex-1" />
          <button className="btn btn-secondary">Add type</button>
        </form>
      </Panel>

      {/* ponytail: severities are a fixed enum mapped to design tokens — custom weights arrive only if a report demands them */}
      <Panel title="Severity Levels (fixed)">
        <p className="mb-3 text-xs text-fg-muted">
          Severities are fixed and color-mapped in the design system. Distribution:
        </p>
        <div className="flex flex-wrap gap-2">
          {byType.map((s) => (
            <Badge key={s.severity} color={s.severity === "critical" || s.severity === "high" ? "signal" : s.severity === "medium" ? "amber" : "gray"}>
              {s.severity}: {s._count}
            </Badge>
          ))}
        </div>
      </Panel>
    </div>
  );
}
