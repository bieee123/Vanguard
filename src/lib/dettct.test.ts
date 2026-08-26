import { describe, expect, it } from "vitest";
import { parseDettctYaml } from "./dettct";

const SAMPLE = `version: "1.2"
file_type: techniques-administration
name: Endpoints
date: 2026-08-20
techniques:
  - technique_id: T1059.001
    technique_name: "PowerShell"
    detection:
      - applicable_to: [all]
        location: [SIEM]
        score_logbook:
          - date: 2026-01-10
            score: 2
          - date: 2026-03-01
            score: 4
    visibility:
      - applicable_to: [all]
        score_logbook:
          - date: 2026-01-10
            score: 3
  - technique_id: T1562.001
    technique_name: "Impair Defenses"
    detection:
      - applicable_to: [all]
        location: []
        score_logbook:
          - date: 2026-01-01
            score: 0
`;

describe("parseDettctYaml", () => {
  it("computes coverage from latest scores", () => {
    const snap = parseDettctYaml(SAMPLE);
    expect(snap.total).toBe(2);
    expect(snap.covered).toBe(1);
    expect(snap.uncovered).toBe(1);
    expect(snap.techniques[0].detectionScore).toBe(4); // latest wins, not max of history order assumptions
    expect(snap.techniques[0].location).toEqual(["SIEM"]);
  });

  it("rejects wrong file types", () => {
    expect(() => parseDettctYaml("file_type: object-group")).toThrow();
  });
});
