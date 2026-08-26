import { describe, expect, it } from "vitest";
import { nextEngagementCode } from "./engagement-code";

describe("nextEngagementCode", () => {
  it("formats zero-padded codes", () => {
    expect(nextEngagementCode(1)).toBe("ENG-001");
    expect(nextEngagementCode(26)).toBe("ENG-026");
  });

  it("does not truncate beyond three digits", () => {
    expect(nextEngagementCode(1234)).toBe("ENG-1234");
  });
});
