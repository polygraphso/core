import { describe, it, expect } from "vitest";
import { normalizeColumnWithFloor } from "./normalize.js";

describe("normalizeColumnWithFloor", () => {
  it("maps min → floor and max → 100", () => {
    const out = normalizeColumnWithFloor([1, 5, 10]);
    expect(out[0]).toBe(10); // floor
    expect(out[2]).toBe(100); // max
    expect(out[1]).toBeCloseTo(50, 5); // midpoint
  });

  it("returns midpoint for every value when max === min", () => {
    expect(normalizeColumnWithFloor([7, 7, 7])).toEqual([55, 55, 55]);
  });

  it("returns midpoint when relative spread is below the variance threshold", () => {
    // values are 100, 101, 102 → spread = 2/102 ≈ 0.02 < 0.1
    expect(normalizeColumnWithFloor([100, 101, 102])).toEqual([55, 55, 55]);
  });

  it("respects a custom floor", () => {
    const out = normalizeColumnWithFloor([0, 10], 20);
    expect(out[0]).toBe(20);
    expect(out[1]).toBe(100);
  });

  it("returns empty array when input is empty", () => {
    expect(normalizeColumnWithFloor([])).toEqual([]);
  });
});
