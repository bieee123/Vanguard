"use client";

import { useState } from "react";
import { cvssBaseScore, cvssSeverity } from "@/lib/cvss";
import { Badge, type BadgeColor } from "@/components/ui/badge";

const SEVERITY_COLOR: Record<string, BadgeColor> = {
  critical: "signal",
  high: "signal",
  medium: "amber",
  low: "amber",
  none: "gray",
};

export function CvssCalculator({ initialVector }: { initialVector?: string | null }) {
  const [vector, setVector] = useState(initialVector ?? "");
  const score = cvssBaseScore(vector.trim());
  const severity = cvssSeverity(score);

  return (
    <div className="rounded-sm border border-line-subtle p-3">
      <p className="label">CVSS v3.1 vector</p>
      <input
        name="cvssVector"
        className="input font-mono text-xs"
        placeholder="AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        value={vector}
        onChange={(e) => setVector(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-3">
        <span className="label !mb-0">Score</span>
        {score === null ? (
          <span className="text-sm text-fg-muted">invalid vector</span>
        ) : (
          <>
            <span className={`font-mono text-lg ${score >= 9 ? "text-signal" : "text-fg-primary"}`}>{score.toFixed(1)}</span>
            {severity && severity !== "none" && (
              <Badge color={SEVERITY_COLOR[severity]}>{severity}</Badge>
            )}
          </>
        )}
      </div>
      <input type="hidden" name="cvssScore" value={score ?? ""} />
    </div>
  );
}
