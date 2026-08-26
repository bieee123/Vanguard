import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import {
  sentinelSimulate,
  submitRuleRequest,
  verifyRuleRequest,
} from "@/server/actions/purple";

const STATUS_COLOR: Record<string, BadgeColor> = {
  draft: "gray",
  pending_review: "amber",
  approved: "blue",
  deployed: "teal",
  verified: "teal",
  rejected: "signal",
};
const NEXT: Record<string, { to: string; label: string; cls: string }[]> = {
  draft: [{ to: "pending_review", label: "Submit", cls: "btn-primary" }],
  pending_review: [
    { to: "approved", label: "SIM approve", cls: "btn-teal" },
    { to: "rejected", label: "SIM reject", cls: "btn-danger" },
  ],
  approved: [{ to: "deployed", label: "SIM deploy", cls: "btn-teal" }],
  deployed: [],
};

export default async function RuleRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const requests = await prisma.ruleRequest.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    include: { project: true, requestedBy: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Rule Requests</h1>
        <form action="/rule-requests" className="flex gap-2">
          <select name="status" defaultValue={status ?? ""} className="input w-auto py-1 text-xs">
            <option value="">All statuses</option>
            {Object.keys(STATUS_COLOR).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary px-2 py-1 text-xs">Filter</button>
        </form>
      </div>

      {/* ponytail: single-column list instead of detail pages — every card fits one screen; split when fields grow */}
      {requests.length === 0 && (
        <Panel>
          <p className="text-sm text-fg-muted">
            No requests. Create drafts from the{" "}
            <Link href="/attack-matrix" className="text-blue hover:underline">
              Gap Report
            </Link>
            .
          </p>
        </Panel>
      )}

      <div className="space-y-3">
        {requests.map((rr) => (
          <Panel
            key={rr.id}
            title={`${rr.techniqueId} — ${rr.status.replace(/_/g, " ")}`}
            actions={<Badge color={STATUS_COLOR[rr.status]}>{rr.status.replace(/_/g, " ")}</Badge>}
          >
            <div className="grid grid-cols-[1fr_20rem] gap-6">
              <div className="space-y-2 text-sm">
                <p className="text-fg-secondary">{rr.justification ?? "No justification."}</p>
                <pre className="max-h-48 overflow-auto rounded-sm bg-raised p-3 font-mono text-[11px] text-fg-secondary">
                  {rr.draftRuleXml}
                </pre>
                <p className="text-xs text-fg-muted">
                  by {rr.requestedBy?.name ?? "?"} · {rr.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  {rr.project && (
                    <>
                      {" · "}
                      <Link href={`/engagements/${rr.project.id}`} className="hover:underline">
                        {rr.project.code}
                      </Link>
                    </>
                  )}
                  {rr.approvedBy && ` · approved by ${rr.approvedBy}`}
                </p>
                {rr.rejectionReason && (
                  <p className="rounded-sm bg-signal-dim px-2 py-1 text-xs text-signal">
                    rejected: {rr.rejectionReason}
                  </p>
                )}
              </div>

              <div className="space-y-2 border-l border-line-subtle pl-6">
                {(NEXT[rr.status] ?? []).map((n) => (
                  <form key={n.to} action={n.to === "pending_review" ? submitRuleRequest : sentinelSimulate}>
                    <input type="hidden" name="id" value={rr.id} />
                    <input type="hidden" name="to" value={n.to} />
                    <button className={`btn ${n.cls} w-full justify-center`}>{n.label}</button>
                    {n.to === "rejected" && (
                      <input
                        name="rejectionReason"
                        placeholder="reason (optional)"
                        className="input mt-2 py-1 text-xs"
                      />
                    )}
                  </form>
                ))}
                {rr.status === "deployed" && (
                  <>
                    <form action={verifyRuleRequest}>
                      <input type="hidden" name="id" value={rr.id} />
                      <input type="hidden" name="passed" value="true" />
                      <button className="btn btn-teal w-full justify-center">Retest passed → verify</button>
                    </form>
                    <form action={verifyRuleRequest}>
                      <input type="hidden" name="id" value={rr.id} />
                      <input type="hidden" name="passed" value="false" />
                      <button className="btn btn-secondary w-full justify-center">
                        Still missed → back to draft
                      </button>
                    </form>
                    <p className="text-[11px] text-fg-muted">
                      Re-run the technique; confirm detection in the Timeline before verifying.
                    </p>
                  </>
                )}
                {["verified", "rejected"].includes(rr.status) && (
                  <p className="text-xs text-fg-muted">Terminal state.</p>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
