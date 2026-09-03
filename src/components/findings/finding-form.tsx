import Link from "next/link";
import { Badge, type BadgeColor } from "@/components/ui/badge";
import { CvssCalculator } from "@/components/findings/cvss-calculator";

const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
const STATUSES = ["open", "retest", "fixed", "accepted_risk", "false_positive"] as const;

export function SeverityBadge({ severity }: { severity: string }) {
  const color: BadgeColor =
    severity === "critical" || severity === "high" ? "signal" : severity === "medium" ? "amber" : "gray";
  return <Badge color={color}>{severity}</Badge>;
}

interface FindingFormProps {
  action: (fd: FormData) => Promise<void>;
  findingId?: string;
  finding?: {
    title: string;
    typeId: string | null;
    severity: string;
    status: string;
    cve: string | null;
    cwe: string | null;
    cvssVector: string | null;
    description: string | null;
    mitigation: string | null;
    replication: string | null;
    attackTechniques: string[];
    references: string[];
  } | null;
  projectId: string;
  types: { id: string; name: string }[];
  currentTags?: string[];
  submitLabel: string;
}

/** Shared create/edit form for a finding. CVSS calculator is the only client island. */
export function FindingForm({ action, findingId, finding, projectId, types, currentTags = [], submitLabel }: FindingFormProps) {
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      {findingId && <input type="hidden" name="id" value={findingId} />}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="label" htmlFor="title">
            Title *
          </label>
          <input id="title" name="title" required className="input" defaultValue={finding?.title} />
        </div>
        <div className="w-44">
          <label className="label" htmlFor="severity">
            Severity
          </label>
          <select id="severity" name="severity" className="input" defaultValue={finding?.severity ?? "medium"}>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="w-44">
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" className="input" defaultValue={finding?.status ?? "open"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_10rem_10rem] gap-3">
        <div>
          <label className="label" htmlFor="typeId">
            Type
          </label>
          {/* ponytail: empty option when no types exist yet — manage in Settings → Findings */}
          <select id="typeId" name="typeId" className="input" defaultValue={finding?.typeId ?? ""}>
            <option value="">—</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cve">
            CVE
          </label>
          <input id="cve" name="cve" className="input font-mono" placeholder="CVE-2026-12345" defaultValue={finding?.cve ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="cwe">
            CWE
          </label>
          <input id="cwe" name="cwe" className="input font-mono" placeholder="CWE-79" defaultValue={finding?.cwe ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="attackTechniques">
            ATT&CK techniques (comma-separated)
          </label>
          <input
            id="attackTechniques"
            name="attackTechniques"
            className="input font-mono text-xs"
            placeholder="T1059.001, T1003.001"
            defaultValue={finding?.attackTechniques.join(", ") ?? ""}
          />
        </div>
        <CvssCalculator initialVector={finding?.cvssVector} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="tags">
            Tags (comma-separated)
          </label>
          <input id="tags" name="tags" className="input" placeholder="web, authz, poc" defaultValue={currentTags.join(", ")} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description (markdown)
        </label>
        <textarea id="description" name="description" rows={5} className="input font-mono text-xs" defaultValue={finding?.description ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="replication">
          Replication steps (markdown)
        </label>
        <textarea id="replication" name="replication" rows={4} className="input font-mono text-xs" defaultValue={finding?.replication ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="mitigation">
          Remediation (markdown)
        </label>
        <textarea id="mitigation" name="mitigation" rows={4} className="input font-mono text-xs" defaultValue={finding?.mitigation ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="references">
          References (one per line)
        </label>
        <textarea id="references" name="references" rows={2} className="input font-mono text-xs" defaultValue={finding?.references.join("\n") ?? ""} />
      </div>
      <button className="btn btn-primary">{submitLabel}</button>
      <Link href="/findings" className="ml-3 text-xs text-fg-muted hover:text-blue">
        Cancel
      </Link>
    </form>
  );
}
