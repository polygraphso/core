import { describe, it, expect } from "vitest";
import { parseSearchArgs, markCoverage, summarize } from "./search.js";

describe("parseSearchArgs", () => {
  it("defaults: no query, limit 25, no filters, table output", () => {
    expect(parseSearchArgs([])).toEqual({
      query: null,
      limit: 25,
      kind: null,
      gradeableOnly: false,
      ungradedOnly: false,
      json: false,
    });
  });

  it("joins bare positional tokens into the query string", () => {
    expect(parseSearchArgs(["google", "drive"]).query).toBe("google drive");
  });

  it("does not swallow a flag value as a query token", () => {
    const a = parseSearchArgs(["slack", "--limit", "10", "--kind", "npm"]);
    expect(a.query).toBe("slack");
    expect(a.limit).toBe(10);
    expect(a.kind).toBe("npm");
  });

  it("accepts --limit= and --kind= forms", () => {
    const a = parseSearchArgs(["--limit=100", "--kind=pypi", "git"]);
    expect(a).toMatchObject({ query: "git", limit: 100, kind: "pypi" });
  });

  it("sets the boolean filter flags", () => {
    expect(parseSearchArgs(["--gradeable", "--ungraded", "--json"])).toMatchObject({
      gradeableOnly: true,
      ungradedOnly: true,
      json: true,
    });
  });

  it("rejects a non-positive --limit", () => {
    expect(() => parseSearchArgs(["--limit", "0"])).toThrow(/--limit/);
    expect(() => parseSearchArgs(["--limit", "-3"])).toThrow(/--limit/);
    expect(() => parseSearchArgs(["--limit", "x"])).toThrow(/--limit/);
  });

  it("rejects an unknown --kind", () => {
    expect(() => parseSearchArgs(["--kind", "docker"])).toThrow(/--kind/);
  });
});

describe("markCoverage", () => {
  const rows = [
    { id: "1", grading_target: "npm/tavily-mcp" },
    { id: "2", grading_target: "pypi/mcp-server-git" },
    { id: "3", grading_target: null }, // unresolved — never counts as graded
  ];

  it("flags a row graded iff its grading_target is in the hosted_runs set", () => {
    const out = markCoverage(rows, new Set(["npm/tavily-mcp"]));
    expect(out.map((r) => r.graded)).toEqual([true, false, false]);
  });

  it("treats a null grading_target as ungraded even against a non-empty set", () => {
    const out = markCoverage(rows, new Set(["npm/tavily-mcp", "pypi/mcp-server-git"]));
    expect(out.find((r) => r.id === "3")!.graded).toBe(false);
  });
});

describe("summarize", () => {
  it("counts total, gradeable, and ungraded-gradeable", () => {
    const marked = [
      { gradeable: true, graded: false },
      { gradeable: true, graded: true },
      { gradeable: false, graded: false },
      { gradeable: null, graded: false },
    ];
    expect(summarize(marked)).toEqual({ total: 4, gradeable: 2, gradeableUngraded: 1 });
  });
});
