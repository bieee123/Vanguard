import { prisma } from "@/lib/db";
import { createTimelineEntry } from "@/server/actions/purple";

const OUTCOMES = ["success", "failed", "blocked"] as const;
const TACTICS = [
  "reconnaissance",
  "initial-access",
  "execution",
  "persistence",
  "privilege-escalation",
  "defense-evasion",
  "credential-access",
  "discovery",
  "lateral-movement",
  "collection",
  "exfiltration",
] as const;

/** Create-entry form. With a fixed engagement it hides the project picker and scopes assets to it. */
export async function TimelineEntryForm({ projectId }: { projectId?: string }) {
  const [projects, assets] = await Promise.all([
    projectId ? Promise.resolve([]) : prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } }),
    projectId
      ? prisma.asset.findMany({
          where: { engagements: { some: { projectId } } },
          orderBy: [{ hostname: "asc" }, { ipAddress: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return (
    <form action={createTimelineEntry} className="space-y-3">
      {projectId ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : projects.length === 0 ? (
        <p className="text-sm text-fg-muted">Create an engagement first.</p>
      ) : (
        <div className="max-w-md">
          <label className="label">Engagement *</label>
          <select name="projectId" required className="input">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.application.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid max-w-4xl grid-cols-[10rem_12rem_12rem_12rem] gap-3">
        <div>
          <label className="label">Technique ID</label>
          <input name="techniqueId" className="input font-mono" placeholder="T1059.001" />
        </div>
        <div>
          <label className="label">Tactic</label>
          <select name="tactic" className="input" defaultValue="">
            <option value="">—</option>
            {TACTICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Asset</label>
          <select name="assetId" className="input" defaultValue="">
            <option value="">—</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.hostname ?? a.ipAddress}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Timestamp</label>
          <input name="timestamp" type="datetime-local" className="input" />
        </div>
      </div>

      <div className="max-w-4xl">
        <label className="label">Action *</label>
        <input name="actionDescription" required className="input" placeholder="Dumped LSASS on WEB-01 via custom tooling" />
      </div>

      {/* oplog replacement: optional technical trace fields (PRD r3 changelog) */}
      <div className="grid max-w-4xl grid-cols-2 gap-3">
        <div>
          <label className="label">Command (optional)</label>
          <input name="command" className="input font-mono text-xs" placeholder="rundll32 comsvcs.dll MiniDump ..." />
        </div>
        <div>
          <label className="label">Technical notes (optional)</label>
          <input name="technicalNotes" className="input font-mono text-xs" />
        </div>
      </div>

      <div className="flex max-w-4xl items-end gap-3">
        <div className="w-40">
          <label className="label">Outcome</label>
          <select name="outcome" className="input" defaultValue="success">
            {OUTCOMES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">Note (optional)</label>
          <input name="note" className="input" />
        </div>
        <button className="btn btn-primary">Log entry</button>
      </div>
    </form>
  );
}
