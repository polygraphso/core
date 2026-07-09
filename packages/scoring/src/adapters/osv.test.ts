import { describe, it, expect } from "vitest";
import { normalizeSeverity } from "./osv.js";

describe("normalizeSeverity", () => {
  it("maps GHSA severity strings to the enum", () => {
    expect(normalizeSeverity("CRITICAL")).toBe("CRITICAL");
    expect(normalizeSeverity("high")).toBe("HIGH");
    expect(normalizeSeverity("Moderate")).toBe("MODERATE");
    expect(normalizeSeverity("low")).toBe("LOW");
  });
  it("tolerates MEDIUM as MODERATE", () => {
    expect(normalizeSeverity("MEDIUM")).toBe("MODERATE");
  });
  it("returns null for absent or unknown values", () => {
    expect(normalizeSeverity(null)).toBeNull();
    expect(normalizeSeverity(undefined)).toBeNull();
    expect(normalizeSeverity("severe")).toBeNull();
  });
});
