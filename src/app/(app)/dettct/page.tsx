import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { importDettctRun } from "@/server/actions/dettct";
import { deleteRun } from "./actions";

export default async function DettctPage() {
  const runs = await prisma.dettctRun.findMany({ orderBy: { runAt: "desc" } });
  const latest = runs[0];
  const techniques = latest
    ? (latest.payload as { techniqueId: string; techniqueName: string; detectionScore: number; visibilityScore: number; location: string[] }[])
        .slice()
        .sort((a, b) => b.detectionScore - a.detectionScore)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Long-term Coverage — DeTT&CT</h1>
        <Link href="/attack-matrix" className="btn btn-secondary">
          ← ATT&CK Matrix
        </Link>
      </div>

      <Panel
        title="Import snapshot"
        description="DeTT&CT runs externally (cron/sidecar) and writes YAML. Upload the file or point at the path."
      >
        <form action={importDettctRun} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="file">
              YAML upload
            </label>
            <input id="file" name="file" type="file" accept=".yaml,.yml" className="input file:mr-2 file:rounded-sm file:border-0 file:bg-raised file:text-fg-secondary" />
          </div>
          <div className="min-w-[18rem] flex-1">
            <label className="label" htmlFor="path">
              …or absolute path on the server
            </label>
            <input id="path" name="path" className="input font-mono text-xs" placeholder="/srv/dettct/techniques-administration_endpoints.yaml" />
          </div>
          <button className="btn btn-primary">Import</button>
        </form>
      </Panel>

      {!latest ? (
        <Panel>
          <p className="text-sm text-fg-muted">No snapshots yet.</p>
        </Panel>
      ) : (
        <>
          {/* coverage summary */}
          <div className="grid grid-cols-3 gap-4">
            <Panel>
              <p className="label">Techniques</p>
              <p className="font-mono text-2xl">{latest.totalTechniques}</p>
            </Panel>
            <Panel>
              <p className="label">Covered</p>
              <p className="font-mono text-2xl text-teal">{latest.coveredCount}</p>
            </Panel>
            <Panel>
              <p className="label">Uncovered</p>
              <p className={`font-mono text-2xl ${latest.totalTechniques - latest.coveredCount > 0 ? "text-signal" : "text-fg-disabled"}`}>
                {latest.totalTechniques - latest.coveredCount}
              </p>
            </Panel>
          </div>

          <Panel title={`${latest.filePath.split("/").pop()} — run ${latest.runAt.toISOString().slice(0, 10)}`}>
            {/* Last updated label is mandatory per design-system §6.5 */}
            <p className="mb-3 text-xs text-fg-muted">
              Snapshot read-only · Last updated: {latest.importedAt.toISOString().slice(0, 16).replace("T", " ")}
            </p>
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Technique</th>
                  <th>Name</th>
                  <th>Detection</th>
                  <th>Visibility</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {techniques.map((t) => (
                  <tr key={t.techniqueId}>
                    <td className="font-mono text-violet">{t.techniqueId}</td>
                    <td>{t.techniqueName}</td>
                    <td>
                      <Badge color={t.detectionScore >= 3 ? "teal" : t.detectionScore > 0 ? "amber" : "signal"}>
                        {t.detectionScore}
                      </Badge>
                    </td>
                    <td className="font-mono text-xs">{t.visibilityScore}</td>
                    <td className="font-mono text-[11px]">{t.location.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title={`Snapshot history (${runs.length})`}>
            <ul className="space-y-1 text-sm">
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-fg-secondary">
                    run {r.runAt.toISOString().slice(0, 10)} · imported{" "}
                    {r.importedAt.toISOString().slice(0, 16).replace("T", " ")} · {r.coveredCount}/{r.totalTechniques} covered
                  </span>
                  <form action={deleteRun}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-danger px-1.5 py-0.5 text-xs">✕</button>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
