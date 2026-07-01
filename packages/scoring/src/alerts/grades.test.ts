import { describe, it, expect } from "vitest";
import { gradeMeetsThreshold } from "./grades.js";

describe("gradeMeetsThreshold", () => {
  it("null threshold always emails (the 'every regrade' default)", () => {
    for (const g of ["A", "B", "C", "D", "F", null, undefined, "weird"]) {
      expect(gradeMeetsThreshold(g, null)).toBe(true);
    }
  });

  // The semantics table: which new grades email under each threshold.
  const cases: Array<[string, string, boolean]> = [
    // "C or worse" → {C, D, F}
    ["A", "C", false], ["B", "C", false], ["C", "C", true], ["D", "C", true], ["F", "C", true],
    // "D or worse" → {D, F}
    ["A", "D", false], ["B", "D", false], ["C", "D", false], ["D", "D", true], ["F", "D", true],
    // "F only" → {F}
    ["A", "F", false], ["B", "F", false], ["C", "F", false], ["D", "F", false], ["F", "F", true],
  ];
  it.each(cases)("grade %s under threshold %s → emails: %s", (grade, min, expected) => {
    expect(gradeMeetsThreshold(grade, min)).toBe(expected);
  });

  it("is case-insensitive on both grade and threshold", () => {
    expect(gradeMeetsThreshold("f", "F")).toBe(true);
    expect(gradeMeetsThreshold("F", "f")).toBe(true);
    expect(gradeMeetsThreshold("b", "c")).toBe(false);
  });

  it("fails open on null/unknown grade — never silently drops a regression", () => {
    expect(gradeMeetsThreshold(null, "F")).toBe(true);
    expect(gradeMeetsThreshold(undefined, "F")).toBe(true);
    expect(gradeMeetsThreshold("E", "F")).toBe(true); // no such grade in the scale
    expect(gradeMeetsThreshold("?", "C")).toBe(true);
  });

  it("fails open on an unrecognized threshold value", () => {
    expect(gradeMeetsThreshold("A", "Z")).toBe(true);
  });
});
