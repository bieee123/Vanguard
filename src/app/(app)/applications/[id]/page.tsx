import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge, type BadgeColor, StatusBadge } from "@/components/ui/badge";
import { ApplicationForm, DeleteApplicationButton } from "../_components/application-form";

const CRITICALITY_COLOR: Record<string, BadgeColor> = {
  critical: "signal",
  high: "amber",
  medium: "blue",
  low: "gray",
};

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const application = await prisma.application.findUnique({
    where: { id },
    include: { projects: { orderBy: { createdAt: "desc" } } },
  });
  if (!application) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-xl font-semibold">{application.name}</h1>
        <Badge color={CRITICALITY_COLOR[application.criticality]}>{application.criticality}</Badge>
      </div>

      <Panel title="Engagements" description={`Targeting this application (${application.projects.length})`}>
        {application.projects.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No engagements yet —{" "}
            <Link href="/engagements/new" className="text-blue hover:underline">
              create one
            </Link>
            .
          </p>
        ) : (
          <table className="table-dense">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Dates</th>
              </tr>
            </thead>
            <tbody>
              {application.projects.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-fg-primary">
                    <Link href={`/engagements/${p.id}`} className="hover:underline">
                      {p.code}
                    </Link>
                  </td>
                  <td>{p.name}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="font-mono text-xs">
                    {p.startDate?.toISOString().slice(0, 10) ?? "?"} →{" "}
                    {p.endDate?.toISOString().slice(0, 10) ?? "?"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Edit Application">
        <ApplicationForm application={application} />
        <div className="mt-6 border-t border-line-subtle pt-4">
          <p className="label">Danger zone</p>
          <DeleteApplicationButton id={application.id} />
        </div>
      </Panel>

      <Link href="/applications" className="text-xs text-fg-muted hover:underline">
        ← Back to applications
      </Link>
    </div>
  );
}
