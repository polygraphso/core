import { describe, it, expect } from "vitest";
import { gradeMeetsThreshold, gradeDropped } from "./grades.js";

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

describe("gradeDropped", () => {
  it("is true only when the grade gets worse", () => {
    expect(gradeDropped("A", "B")).toBe(true);
    expect(gradeDropped("B", "D")).toBe(true);
    expect(gradeDropped("A", "F")).toBe(true);
  });
  it("is false when the grade holds or improves", () => {
    expect(gradeDropped("B", "B")).toBe(false);
    expect(gradeDropped("D", "A")).toBe(false);
    expect(gradeDropped("F", "C")).toBe(false);
  });
  it("never fabricates a drop from an unknown grade (no baseline)", () => {
    expect(gradeDropped(null, "F")).toBe(false);
    expect(gradeDropped(undefined, "F")).toBe(false);
    expect(gradeDropped("A", null)).toBe(false);
    expect(gradeDropped("A", "E")).toBe(false); // no such grade
  });
  it("is case-insensitive", () => {
    expect(gradeDropped("a", "b")).toBe(true);
    expect(gradeDropped("B", "a")).toBe(false);
  });
});
