import { describe, it, expect } from "vitest";
import { filterRows, paginate, pageCount, formatElapsed } from "./adminTable";
import type { AdminRow } from "./store";

const row = (server: string, target_kind: string): AdminRow => ({
  hosted_run_id: server,
  server,
  target_kind,
  version: "",
  methodology_version: "litmus-v11",
  grade: "A",
  published: false,
  status: "none",
  attestation_uid: null,
  error: null,
});

const rows = [
  row("npm/@arcadia-finance/mcp-server", "registry_ref"),
  row("github/anthropics/skills#skills/pdf", "skill"),
  row("npm/autonomad-travel", "registry_ref"),
  row("github/BankrBot/skills#zerion", "skill"),
];

describe("filterRows — kind", () => {
  it("returns every row when kind is 'all'", () => {
    expect(filterRows(rows, { query: "", kind: "all" })).toHaveLength(4);
  });
  it("keeps only MCPs (registry_ref)", () => {
    expect(filterRows(rows, { query: "", kind: "registry_ref" }).map((r) => r.server)).toEqual([
      "npm/@arcadia-finance/mcp-server",
      "npm/autonomad-travel",
    ]);
  });
  it("keeps only skills", () => {
    expect(filterRows(rows, { query: "", kind: "skill" }).every((r) => r.target_kind === "skill")).toBe(true);
  });
});

describe("filterRows — query", () => {
  it("matches a server substring, case-insensitive", () => {
    expect(filterRows(rows, { query: "ARCADIA", kind: "all" }).map((r) => r.server)).toEqual([
      "npm/@arcadia-finance/mcp-server",
    ]);
  });
  it("combines query AND kind", () => {
    expect(filterRows(rows, { query: "skills", kind: "skill" })).toHaveLength(2);
    expect(filterRows(rows, { query: "skills", kind: "registry_ref" })).toHaveLength(0);
  });
  it("ignores a blank/whitespace query", () => {
    expect(filterRows(rows, { query: "   ", kind: "all" })).toHaveLength(4);
  });
});

describe("paginate", () => {
  it("slices a 0-indexed page", () => {
    expect(paginate([1, 2, 3, 4, 5], 0, 2)).toEqual([1, 2]);
    expect(paginate([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4]);
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([5]);
  });
});

describe("pageCount", () => {
  it("computes the page count, never below 1", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
  });
});

describe("formatElapsed", () => {
  it("formats seconds as m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(5)).toBe("0:05");
    expect(formatElapsed(65)).toBe("1:05");
    expect(formatElapsed(600)).toBe("10:00");
  });
  it("floors fractional seconds and clamps negatives", () => {
    expect(formatElapsed(9.8)).toBe("0:09");
    expect(formatElapsed(-3)).toBe("0:00");
  });
});
