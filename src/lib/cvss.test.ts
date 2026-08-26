import { describe, expect, it } from "vitest";
import { cvssBaseScore, cvssSeverity, parseCvssVector } from "./cvss";

describe("cvssBaseScore", () => {
  it("scores known vectors", () => {
    // reference values from the FIRST calculator
    expect(cvssBaseScore("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")).toBe(9.8);
    expect(cvssBaseScore("AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H")).toBe(10);
    expect(cvssBaseScore("AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N")).toBe(5.3);
    expect(cvssBaseScore("AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L")).toBe(3.8);
    expect(cvssBaseScore("AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N")).toBe(0);
  });

  it("rejects invalid vectors", () => {
    expect(cvssBaseScore("not-a-vector")).toBeNull();
    expect(cvssBaseScore("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H")).toBeNull(); // missing A
    expect(cvssBaseScore("AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")).toBeNull(); // bad value
  });
});

describe("parseCvssVector", () => {
  it("parses all metrics case-insensitively", () => {
    const parsed = parseCvssVector("av:n/ac:l/pr:n/ui:n/s:u/c:h/i:h/a:h");
    expect(parsed?.AV).toBe("N");
    expect(parsed?.A).toBe("H");
  });
});

describe("cvssSeverity", () => {
  it("maps score bands", () => {
    expect(cvssSeverity(9.8)).toBe("critical");
    expect(cvssSeverity(7.0)).toBe("high");
    expect(cvssSeverity(5.3)).toBe("medium");
    expect(cvssSeverity(3.7)).toBe("low");
    expect(cvssSeverity(0)).toBe("none");
    expect(cvssSeverity(null)).toBeNull();
  });
});
