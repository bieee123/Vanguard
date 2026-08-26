import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { createEngagement } from "@/server/actions/engagements";

const TYPES = [
  "internal_pentest",
  "red_team_exercise",
  "purple_team_drill",
  "bug_bounty_triage",
  "ad_hoc",
] as const;

export default async function NewEngagementPage() {
  const applications = await prisma.application.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">New Engagement</h1>

      {applications.length === 0 ? (
        <EmptyState
          message="An engagement must target an application — create one first."
          action={
            <Link href="/applications/new" className="btn btn-primary">
              New Application
            </Link>
          }
        />
      ) : (
        <Panel>
          <form action={createEngagement} className="space-y-3">
            <div>
              <label className="label" htmlFor="applicationId">
                Application *
              </label>
              <select id="applicationId" name="applicationId" required className="input">
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="name">
                Name *
              </label>
              <input id="name" name="name" required className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="type">
                  Type
                </label>
                <select id="type" name="type" className="input" defaultValue="internal_pentest">
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div />
              <div>
                <label className="label" htmlFor="startDate">
                  Start date
                </label>
                <input id="startDate" name="startDate" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="endDate">
                  End date
                </label>
                <input id="endDate" name="endDate" type="date" className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <textarea id="description" name="description" rows={3} className="input" />
            </div>
            <button className="btn btn-primary">Create Engagement</button>
          </form>
        </Panel>
      )}
      <Link href="/engagements" className="text-xs text-fg-muted hover:underline">
        ← Back to engagements
      </Link>
    </div>
  );
}
