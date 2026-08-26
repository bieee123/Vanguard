import { describe, expect, it } from "vitest";
import { mockCorrelate } from "./mock-sentinel";

describe("mockCorrelate", () => {
  it("is deterministic per technique", () => {
    const a = mockCorrelate("T1059.001", new Date("2026-08-01T00:00:00Z"));
    const b = mockCorrelate("T1059.001", new Date("2026-08-01T00:00:00Z"));
    expect(a).toEqual(b);
  });

  it("produces at least one gap across a spread of techniques", () => {
    const results = Array.from({ length: 24 }, (_, i) => mockCorrelate(`T${1000 + i}`, new Date()));
    expect(results.some((r) => r.verdict === "not_detected")).toBe(true);
  });

  it("attaches an alert whenever something was seen", () => {
    const r = mockCorrelate("T1003.001", new Date());
    if (r.verdict !== "not_detected" && r.verdict !== "partial") {
      expect(r.alert).not.toBeNull();
      expect(r.alert!.alertId).toMatch(/^ALT-/);
    }
  });
});
