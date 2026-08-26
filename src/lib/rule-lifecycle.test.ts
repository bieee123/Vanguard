import { describe, expect, it } from "vitest";
import { canTransition, allowedTargets } from "./rule-lifecycle";

describe("rule lifecycle", () => {
  it("allows submit from draft only", () => {
    expect(canTransition("draft", "pending_review")).toBe("submit");
    expect(canTransition("draft", "approved")).toBeNull();
  });

  it("routes approve/reject/deploy through sentinel commands", () => {
    expect(canTransition("pending_review", "approved")).toBe("sentinel:approve");
    expect(canTransition("pending_review", "rejected")).toBe("sentinel:reject");
    expect(canTransition("approved", "deployed")).toBe("sentinel:deploy");
  });

  it("verify can pass or bounce back to draft, never skip steps", () => {
    expect(canTransition("deployed", "verified")).toBe("operator:verify");
    expect(canTransition("deployed", "draft")).toBe("operator:verify-failed");
    expect(canTransition("approved", "verified")).toBeNull();
    expect(canTransition("rejected", "deployed")).toBeNull();
    expect(canTransition("verified", "draft")).toBeNull();
  });

  it("lists targets", () => {
    expect(allowedTargets("pending_review")).toEqual(["approved", "rejected"]);
    expect(allowedTargets("verified")).toEqual([]);
  });
});
