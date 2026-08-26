import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";import { FindingForm, SeverityBadge } from "@/components/findings/finding-form";
import {
  deleteFinding,
  linkFindingAsset,
  setFindingStatus,
  unlinkFindingAsset,
  updateFinding,
} from "@/server/actions/findings";

export default async function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const finding = await prisma.finding.findUnique({
    where: { id },
    include: {
      project: { include: { application: true } },
      type: true,
      tags: { include: { tag: true } },
      assets: { include: { asset: true } },
    },
  });
  if (!finding) notFound();

  const [types, assets] = await Promise.all([
    prisma.findingType.findMany({ orderBy: { name: "asc" } }),
    prisma.asset.findMany({
      where: { engagements: { some: { projectId: finding.projectId } } },
      orderBy: [{ hostname: "asc" }, { ipAddress: "asc" }],
    }),
  ]);
  const linkedAssetIds = new Set(finding.assets.map((a) => a.assetId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/engagements/${finding.projectId}`} className="font-mono text-sm text-fg-muted hover:underline">
          {finding.project.code}
        </Link>
        <h1 className="font-display text-xl font-semibold">{finding.title}</h1>
        <SeverityBadge severity={finding.severity} />
        <Badge color="gray">{finding.status.replace(/_/g, " ")}</Badge>
        {finding.cve && <span className="font-mono text-xs text-fg-muted">{finding.cve}</span>}
        {finding.cvssScore !== null && (
          <span className="font-mono text-xs text-fg-muted">CVSS {Number(finding.cvssScore)}</span>
        )}
      </div>

      {/* quick status transitions (retest workflow) */}
      <form action={setFindingStatus} className="flex items-center gap-2">
        <input type="hidden" name="id" value={finding.id} />
        <select name="status" defaultValue={finding.status} className="input w-auto py-1 text-xs">
          {["open", "retest", "fixed", "accepted_risk", "false_positive"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary px-2 py-1 text-xs">Set status</button>
      </form>

      <Panel title="Affected Assets" description="Assets linked to this engagement">
        <ul className="space-y-1">
          {finding.assets.map(({ asset }) => (
            <li key={asset.id} className="flex items-center justify-between text-sm">
              <Link href={`/assets/${asset.id}`} className="font-mono text-xs text-blue hover:underline">
                {asset.hostname ?? asset.ipAddress}
              </Link>
              <form action={unlinkFindingAsset}>
                <input type="hidden" name="findingId" value={finding.id} />
                <input type="hidden" name="assetId" value={asset.id} />
                <button className="btn btn-danger px-1.5 py-0.5 text-xs">Unlink</button>
              </form>
            </li>
          ))}
          {finding.assets.length === 0 && <li className="text-sm text-fg-muted">No assets linked.</li>}
        </ul>
        <form action={linkFindingAsset} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
          <input type="hidden" name="findingId" value={finding.id} />
          <select name="assetId" required className="input flex-1 text-xs">
            {assets
              .filter((a) => !linkedAssetIds.has(a.id))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.hostname ?? a.ipAddress}
                </option>
              ))}
          </select>
          <button className="btn btn-secondary">Link</button>
        </form>
      </Panel>

      <Panel title="Edit Finding">
        <FindingForm
          action={updateFinding}
          findingId={finding.id}
          finding={{
            title: finding.title,
            typeId: finding.typeId,
            severity: finding.severity,
            status: finding.status,
            cve: finding.cve,
            cwe: finding.cwe,
            cvssVector: finding.cvssVector,
            description: finding.description,
            mitigation: finding.mitigation,
            replication: finding.replication,
            attackTechniques: finding.attackTechniques,
            references: finding.references,
          }}
          projectId={finding.projectId}
          types={types}
          currentTags={finding.tags.map((t) => t.tag.name)}
          submitLabel="Save changes"
        />
        <div className="mt-6 border-t border-line-subtle pt-4">
          <p className="label">Danger zone</p>
          <form action={deleteFinding}>
            <input type="hidden" name="id" value={finding.id} />
            <button className="btn btn-danger">Delete finding</button>
          </form>
        </div>
      </Panel>

      <Link href="/findings" className="text-xs text-fg-muted hover:underline">
        ← Back to findings
      </Link>
    </div>
  );
}
