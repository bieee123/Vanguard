// CVSS v3.1 base score calculator (FIRST specification).
// ponytail: CVSS v4 scoring not implemented — score entered manually until a report needs it.

const ATTACK_VECTOR = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 } as const;
const ATTACK_COMPLEXITY = { L: 0.77, H: 0.44 } as const;
const PRIVILEGES_REQUIRED = {
  U: { N: 0.85, L: 0.62, H: 0.27 },
  C: { N: 0.85, L: 0.68, H: 0.5 },
} as const;
const USER_INTERACTION = { N: 0.85, R: 0.62 } as const;
const CIA_IMPACT = { H: 0.56, L: 0.22, N: 0 } as const;

export type CvssMetricTable = typeof ATTACK_VECTOR | typeof ATTACK_COMPLEXITY | typeof USER_INTERACTION | typeof CIA_IMPACT;

export function parseCvssVector(vector: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const part of vector.split("/")) {
    const [k, v] = part.split(":");
    if (!k || !v) return null;
    out[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  for (const k of ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]) {
    if (!(k in out)) return null;
  }
  return out;
}

function metricValue<T extends Record<string, number>>(table: T, key: string): number | null {
  return key in table ? table[key as keyof T] : null;
}

/** Base score per CVSS v3.1; null when the vector is invalid. */
export function cvssBaseScore(vector: string): number | null {
  const m = parseCvssVector(vector);
  if (!m) return null;

  const av = metricValue(ATTACK_VECTOR, m.AV);
  const ac = metricValue(ATTACK_COMPLEXITY, m.AC);
  const ui = metricValue(USER_INTERACTION, m.UI);
  const scopeChanged = m.S === "C";
  if (!["U", "C"].includes(m.S)) return null;
  const pr = metricValue(PRIVILEGES_REQUIRED[scopeChanged ? "C" : "U"], m.PR);
  const issC = metricValue(CIA_IMPACT, m.C);
  const issI = metricValue(CIA_IMPACT, m.I);
  const issA = metricValue(CIA_IMPACT, m.A);
  if ([av, ac, ui, pr, issC, issI, issA].some((v) => v === null)) return null;
  if (!av || !ac || !ui || !pr) return null;

  const iscBase = 1 - (1 - (issC as number)) * (1 - (issI as number)) * (1 - (issA as number));
  const impact = scopeChanged ? 7.52 * (iscBase - 0.02) : 6.42 * iscBase;
  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * (pr as number) * (ui as number);
  // spec "Roundup": smallest number ≥ input with 1 decimal digit
  return Math.ceil(Math.min(impact + exploitability, 10) * 10) / 10;
}

/** Severity band from a base score (CVSS v3.1 qualitative ratings). */
export function cvssSeverity(score: number | null): "critical" | "high" | "medium" | "low" | "none" | null {
  if (score === null) return null;
  if (score === 0) return "none";
  if (score <= 3.9) return "low";
  if (score <= 6.9) return "medium";
  if (score <= 8.9) return "high";
  return "critical";
}
