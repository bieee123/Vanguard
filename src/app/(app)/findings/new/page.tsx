import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { FindingForm } from "@/components/findings/finding-form";
import { createFinding } from "@/server/actions/findings";

export default async function NewFindingPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: preselect } = await searchParams;
  const [projects, types] = await Promise.all([
    prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } }),
    prisma.findingType.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (projects.length === 0) {
    return (
      <EmptyState
        message="Findings live inside an engagement — create one first."
        action={
          <Link href="/engagements/new" className="btn btn-primary">
            New Engagement
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Finding</h1>
      <Panel>
        <div className="mb-4">
          <label className="label" htmlFor="projectPicker">
            Engagement *
          </label>
          {/* ponytail: project choice is a plain GET jump — keeps the shared form a pure server component */}
          <form action="/findings/new" method="get" className="flex max-w-md gap-2">
            <select
              id="projectPicker"
              name="project"
              defaultValue={preselect ?? ""}
              className="input"
              onChange={undefined}
            >
              <option value="" disabled>
                Select engagement…
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.application.name}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary">Load form</button>
          </form>
        </div>

        {preselect ? (
          <FindingForm action={createFinding} projectId={preselect} types={types} submitLabel="Create Finding" />
        ) : (
          <p className="text-sm text-fg-muted">Pick an engagement above to start writing the finding.</p>
        )}
      </Panel>
    </div>
  );
}
