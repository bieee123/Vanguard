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
};

export default async function ApplicationsPage() {
  const applications = await prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { projects: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Applications</h1>
        <Link href="/applications/new" className="btn btn-primary">
          New Application
        </Link>
      </div>

      {applications.length === 0 ? (
        <EmptyState message="No applications yet — an application is the internal target a pentest is run against." />
      ) : (
        <Panel>
          <table className="table-dense">
            <thead>
              <tr>
                <th>Name</th>
                <th>Criticality</th>
                <th>Owning Team</th>
                <th>Repository</th>
                <th>Engagements</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td className="font-medium text-fg-primary">
                    <Link href={`/applications/${app.id}`} className="hover:underline">
                      {app.name}
                    </Link>
                  </td>
                  <td>
                    <Badge color={CRITICALITY_COLOR[app.criticality]}>{app.criticality}</Badge>
                  </td>
                  <td>{app.owningTeam ?? "—"}</td>
                  <td className="font-mono text-xs">{app.repoUrl ?? "—"}</td>
                  <td className="font-mono">{app._count.projects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
