import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, type BadgeColor } from "@/components/ui/badge";

const CRITICALITY_COLOR: Record<string, BadgeColor> = {
  critical: "signal",
  high: "amber",
  medium: "blue",
  low: "gray",
  unknown: "gray",
};
const STATUS_COLOR: Record<string, BadgeColor> = {
  compromised: "signal",
  in_scope: "teal",
  out_of_scope: "gray",
  unverified: "amber",
  not_compromised: "teal",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; criticality?: string; status?: string }>;
}) {
  const { q, criticality, status } = await searchParams;
  const assets = await prisma.asset.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { hostname: { contains: q, mode: "insensitive" } },
                { ipAddress: { contains: q } },
                { businessUnit: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        criticality ? { criticality: criticality as never } : {},
        status ? { status: status as never } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { engagements: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Asset Inventory</h1>
        <Link href="/assets/new" className="btn btn-primary">
          New Asset
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" action="/assets">
        <input name="q" placeholder="Search hostname / IP / unit…" defaultValue={q} className="input max-w-xs" />
        <select name="criticality" defaultValue={criticality ?? ""} className="input w-auto">
          <option value="">All criticality</option>
          {["critical", "high", "medium", "low", "unknown"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className="input w-auto">
          <option value="">All status</option>
          {["unverified", "in_scope", "out_of_scope", "compromised", "not_compromised"].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary">Filter</button>
      </form>

      {assets.length === 0 ? (
        <EmptyState message="No assets match — add hosts, IPs and services discovered during recon." />
      ) : (
        <Panel>
          <table className="table-dense">
            <thead>
              <tr>
                <th>Host / IP</th>
                <th>Business Unit</th>
                <th>Criticality</th>
                <th>Status</th>
                <th>Engagements</th>
                <th>Discovered by</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td className="font-mono text-xs text-fg-primary">
                    <Link href={`/assets/${a.id}`} className="hover:underline">
                      {a.hostname ?? a.ipAddress}
                      {a.hostname && a.ipAddress && ` (${a.ipAddress})`}
                    </Link>
                  </td>
                  <td>{a.businessUnit ?? "—"}</td>
                  <td>
                    <Badge color={CRITICALITY_COLOR[a.criticality]}>{a.criticality}</Badge>
                  </td>
                  <td>
                    <Badge color={STATUS_COLOR[a.status]}>{a.status.replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="font-mono">{a._count.engagements}</td>
                  <td className="text-xs">{a.discoveredBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
