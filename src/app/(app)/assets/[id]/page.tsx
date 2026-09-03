import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import {
  deleteAsset,
  linkAssetToEngagement,
  unlinkAssetFromEngagement,
  updateAsset,
} from "@/server/actions/assets";

const CRITICALITIES = ["critical", "high", "medium", "low", "unknown"] as const;
const STATUSES = ["unverified", "in_scope", "out_of_scope", "compromised", "not_compromised"] as const;

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: { engagements: { include: { project: { include: { application: true } } } } },
  });
  if (!asset) notFound();

  const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });
  const linkedIds = new Set(asset.engagements.map((e) => e.projectId));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">
          {asset.hostname ?? asset.ipAddress}
        </h1>
        <Badge color="gray">{asset.criticality}</Badge>
      </div>

      <Panel title="Linked Engagements" description={`${asset.engagements.length} engagement(s)`}>
        <ul className="space-y-1">
          {asset.engagements.map(({ project }) => (
            <li key={project.id} className="flex items-center justify-between text-sm">
              <Link href={`/engagements/${project.id}`} className="text-blue hover:text-blue">
                <span className="font-mono">{project.code}</span> {project.name}
              </Link>
              <form action={unlinkAssetFromEngagement}>
                <input type="hidden" name="assetId" value={asset.id} />
                <input type="hidden" name="projectId" value={project.id} />
                <button className="btn btn-danger px-1.5 py-0.5 text-xs">Unlink</button>
              </form>
            </li>
          ))}
          {asset.engagements.length === 0 && <li className="text-sm text-fg-muted">Not linked to any engagement.</li>}
        </ul>
        <form action={linkAssetToEngagement} className="mt-3 flex gap-2 border-t border-line-subtle pt-3">
          <input type="hidden" name="assetId" value={asset.id} />
          <select name="projectId" required className="input flex-1 text-xs">
            {projects
              .filter((p) => !linkedIds.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.application.name}
                </option>
              ))}
          </select>
          <button className="btn btn-secondary">Link</button>
        </form>
      </Panel>

      <Panel title="Edit Asset">
        <form action={updateAsset} className="space-y-3">
          <input type="hidden" name="id" value={asset.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="hostname">
                Hostname
              </label>
              <input id="hostname" name="hostname" className="input font-mono" defaultValue={asset.hostname ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="ipAddress">
                IP address
              </label>
              <input id="ipAddress" name="ipAddress" className="input font-mono" defaultValue={asset.ipAddress ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="osFingerprint">
                OS / service fingerprint
              </label>
              <input id="osFingerprint" name="osFingerprint" className="input font-mono" defaultValue={asset.osFingerprint ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="businessUnit">
                Business unit
              </label>
              <input id="businessUnit" name="businessUnit" className="input" defaultValue={asset.businessUnit ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label" htmlFor="criticality">
                Criticality
              </label>
              <select id="criticality" name="criticality" className="input" defaultValue={asset.criticality}>
                {CRITICALITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select id="status" name="status" className="input" defaultValue={asset.status}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="discoveredBy">
                Discovered by
              </label>
              <input id="discoveredBy" name="discoveredBy" className="input" defaultValue={asset.discoveredBy ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="sentinelAssetId">
                Sentinel ID (M12)
              </label>
              <input id="sentinelAssetId" name="sentinelAssetId" className="input font-mono" defaultValue={asset.sentinelAssetId ?? ""} />
            </div>
          </div>
          <button className="btn btn-primary">Save changes</button>
        </form>
        <div className="mt-6 border-t border-line-subtle pt-4">
          <p className="label">Danger zone</p>
          <form action={deleteAsset}>
            <input type="hidden" name="id" value={asset.id} />
            <button className="btn btn-danger">Delete asset</button>
          </form>
        </div>
      </Panel>

      <BackLink href="/assets">Back to assets</BackLink>
    </div>
  );
}
