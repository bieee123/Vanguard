// Rule request lifecycle guard (PRD M7): UI may only submit & verify-retest;
// other transitions come from Sentinel (simulated via dev commands here).

export type RuleStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "deployed"
  | "rejected"
  | "verified";

const TRANSITIONS: Record<RuleStatus, Partial<Record<RuleStatus, string>>> = {
  draft: {
    pending_review: "submit", // operator action
  },
  pending_review: {
    approved: "sentinel:approve",
    rejected: "sentinel:reject",
  },
  approved: {
    deployed: "sentinel:deploy",
  },
  deployed: {
    verified: "operator:verify", // retest passed
    draft: "operator:verify-failed", // still missed → back to drafting
  },
  rejected: {}, // terminal until a new request is drafted
  verified: {}, // terminal — gap considered resolved
};

export function canTransition(from: RuleStatus, to: RuleStatus): string | null {
  return TRANSITIONS[from]?.[to] ?? null;
}

export function allowedTargets(from: RuleStatus): RuleStatus[] {
  return Object.keys(TRANSITIONS[from] ?? {}) as RuleStatus[];
}

/** Map Sentinel lifecycle status back to Vanguard's local status. */
export function mapSentinelStatus(s: string): RuleStatus {
  switch (s) {
    case "approved":
    case "deployed":
    case "rejected":
    case "verified":
      return s;
    case "verify_failed":
      return "draft";
    default:
      return "pending_review";
  }
}
