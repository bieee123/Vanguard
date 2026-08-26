import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/badge";
import { updateEngagement, deleteEngagement } from "@/server/actions/engagements";

export default async function EngagementEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-mono text-fg-muted">{project.code}</h1>
        <h1 className="font-display text-xl font-semibold">{project.name}</h1>
        <StatusBadge status={project.status} />
      </div>

      <Panel title="Edit Engagement">
        <form action={updateEngagement} className="space-y-3">
          <input type="hidden" name="id" value={project.id} />
          <div>
            <label className="label" htmlFor="name">
              Name *
            </label>
            <input id="name" name="name" required className="input" defaultValue={project.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="status">
                Status
              </label>
              <select id="status" name="status" className="input" defaultValue={project.status}>
                {["planned", "active", "paused", "completed", "reported"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="phase">
                Phase
              </label>
              <select id="phase" name="phase" className="input" defaultValue={project.phase}>
                {["recon", "exploitation", "post_exploitation", "reporting"].map((p) => (
                  <option key={p} value={p}>
                    {p.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="startDate">
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="input"
                defaultValue={project.startDate?.toISOString().slice(0, 10) ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="endDate">
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="input"
                defaultValue={project.endDate?.toISOString().slice(0, 10) ?? ""}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="input"
              defaultValue={project.description ?? ""}
            />
          </div>
          <button className="btn btn-primary">Save changes</button>
        </form>
        <div className="mt-6 border-t border-line-subtle pt-4">
          <p className="label">Danger zone</p>
          <form action={deleteEngagement}>
            <input type="hidden" name="id" value={project.id} />
            <button className="btn btn-danger">Delete engagement</button>
          </form>
        </div>
      </Panel>

      <Link href={`/engagements/${project.id}`} className="text-xs text-fg-muted hover:underline">
        ← Back to engagement
      </Link>
    </div>
  );
}
