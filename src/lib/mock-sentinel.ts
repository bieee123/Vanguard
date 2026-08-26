// Deterministic Sentinel alert mock (PRD M7: correlation is mocked until M12).
// Same technique always produces the same verdict so demos and tests are stable.

export interface MockAlert {
  alertId: string;
  ruleName: string;
  detectedAt: Date; // entry timestamp + delay
  delaySeconds: number;
}

export type MockVerdict = "detected" | "not_detected" | "partial" | "detected_late";

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Returns the suggested verdict + optional alert for a technique.
 * Buckets by hash: ~1/3 not_detected (gaps must be common enough to demo),
 * rest split between clean detection, partial, and late detection.
 */
export function mockCorrelate(
  techniqueId: string,
  entryTimestamp: Date
): { verdict: MockVerdict; alert: MockAlert | null } {
  const bucket = hash(techniqueId.toUpperCase()) % 6;
  const alertId = `ALT-${hash(techniqueId.toUpperCase()).toString(16).toUpperCase().slice(0, 8)}`;

  if (bucket === 0) {
    return { verdict: "not_detected", alert: null };
  }
  if (bucket === 1) {
    return { verdict: "partial", alert: null };
  }
  if (bucket === 2 || bucket === 3) {
    return {
      verdict: "detected",
      alert: {
        alertId,
        ruleName: `Sentinel rule for ${techniqueId}`,
        delaySeconds: 20 + (bucket * 17) % 60,
        detectedAt: new Date(entryTimestamp.getTime() + (20 + (bucket * 17) % 60) * 1000),
      },
    };
  }
  // bucket 4-5: late detection with meaningful delay
  const delay = 300 + bucket * 137;
  return {
    verdict: "detected_late",
    alert: {
      alertId,
      ruleName: `Sentinel rule for ${techniqueId}`,
      delaySeconds: delay,
      detectedAt: new Date(entryTimestamp.getTime() + delay * 1000),
    },
  };
}
